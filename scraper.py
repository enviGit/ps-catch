import os
import random
import re
import time
from datetime import datetime, timedelta, timezone

import requests
from supabase import Client, create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Missing access keys.")
    exit()

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

REGIONS = {"en-US": "USD", "en-GB": "GBP", "de-DE": "EUR", "pl-PL": "PLN"}

CATEGORIES = [
    {"id": "4cbf39e2-5749-4970-ba81-93a489e4570c", "type": "Game"},  # Katalog PS5
    {"id": "85448d87-aa7b-4318-9997-7d25f4d275a4", "type": "Game"},  # Katalog PS4
    {"id": "51c9aa7a-c0c7-4b68-90b4-328ad11bf42e", "type": "DLC"},  # Katalog DLC
]


def get_universal_id(game):
    concept = game.get("concept")
    if concept and "id" in concept:
        return str(concept["id"])
    return str(game.get("id", ""))


def scrape_multi_region_deals():
    base_url = "https://web.np.playstation.com/api/graphql/v1/op"
    master_games_dict = {}
    name_to_uid_map = {}
    current_time_iso = datetime.now(timezone.utc).isoformat()

    for locale, currency in REGIONS.items():
        print(f"\nScanning region: {locale}")
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "x-apollo-operation-name": "categoryGridRetrieve",
            "x-psn-store-locale-override": locale,
            "apollographql-client-name": "@sie-ppr-web-store/app",
            "apollographql-client-version": "0.109.0",
        }

        for cat in CATEGORIES:
            category_id = cat["id"]
            item_type = cat["type"]

            print(f"  Scanning category: {category_id} ({item_type})")
            offset = 0
            size = 100

            while True:
                params = {
                    "operationName": "categoryGridRetrieve",
                    "variables": f'{{"id":"{category_id}","pageArgs":{{"size":{size},"offset":{offset}}}}}',
                    "extensions": '{"persistedQuery":{"version":1,"sha256Hash":"257713466fc3264850aa473409a29088e3a4115e6e69e9fb3e061c8dd5b9f5c6"}}',
                }

                try:
                    response = requests.get(base_url, headers=headers, params=params)
                    data = response.json()

                    if "data" not in data or not data["data"]:
                        break

                    grid = data["data"].get("categoryGridRetrieve")
                    if not grid:
                        break

                    products = grid.get("products")
                    if not products:
                        break

                    for game in products:
                        price_info = game.get("price")
                        if not price_info:
                            continue

                        raw_base = price_info.get("basePrice")
                        if not raw_base:
                            continue

                        base_str = str(raw_base).lower()

                        free_keywords = ["free", "bezp", "kostenlos", "0.00", "0,00"]
                        is_free = (
                            any(kw in base_str for kw in free_keywords)
                            or base_str.strip() == "0"
                        )

                        if not is_free and not any(char.isdigit() for char in base_str):
                            continue

                        if is_free:
                            final_base = "Bezpłatne" if currency == "PLN" else "Free"
                            final_discount = final_base
                        else:
                            final_base = raw_base
                            final_discount = price_info.get("discountedPrice")

                        raw_id = get_universal_id(game)
                        name = game.get("name", "Unknown")
                        country_code = locale.split("-")[1].upper()
                        platforms = game.get("platforms", [])

                        normalized_name = re.sub(r"[^a-z0-9]", "", name.lower())
                        platforms_str = "".join(sorted(platforms))
                        map_key = f"{normalized_name}_{platforms_str}"

                        if map_key in name_to_uid_map:
                            uid = name_to_uid_map[map_key]
                        else:
                            uid = raw_id
                            name_to_uid_map[map_key] = uid

                        if uid not in master_games_dict:
                            master_games_dict[uid] = {
                                "game_id": uid,
                                "title": name,
                                "type": item_type,
                                "platforms": ", ".join(platforms),
                                "cover_url": next(
                                    (
                                        m["url"]
                                        for m in game.get("media", [])
                                        if m["role"] in ["MASTER", "PORTRAIT_BANNER"]
                                    ),
                                    "",
                                ),
                                "prices": {},
                                "last_seen": current_time_iso,
                            }

                        if country_code in ["US", "GB"]:
                            master_games_dict[uid]["title"] = name

                        master_games_dict[uid]["prices"][country_code] = {
                            "base": final_base,
                            "discount": final_discount,
                            "currency": currency,
                        }

                    page_info = grid.get("pageInfo")
                    if not page_info or page_info.get("isLast"):
                        break

                    offset += size
                    time.sleep(random.uniform(0.5, 1.2))

                except Exception as e:
                    print(f"Download error at offset {offset}: {e}")
                    break

    games_list = list(master_games_dict.values())
    print(f"\nPrepared {len(games_list)} unique games.")

    for i in range(0, len(games_list), 500):
        batch = games_list[i : i + 500]
        try:
            supabase.table("deals").upsert(batch, on_conflict="game_id").execute()
            print(f"Batch {i} sent.")
        except Exception as e:
            print(f"Batch write error: {e}")

    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    try:
        supabase.rpc("delete_old_deals", {"cutoff": yesterday}).execute()
        print("Database cleanup completed. Wishlisted games protected.")
    except Exception as e:
        print(f"Cleanup error: {e}")


if __name__ == "__main__":
    scrape_multi_region_deals()
