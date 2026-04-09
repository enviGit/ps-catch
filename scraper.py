import os
import random
import time
from datetime import datetime, timedelta, timezone

import requests
from supabase import Client, create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Missing access keys. Script stopped.")
    exit()

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

REGIONS = {"pl-PL": "PLN", "en-US": "USD", "en-GB": "GBP", "de-DE": "EUR"}


def scrape_multi_region_deals():
    base_url = "https://web.np.playstation.com/api/graphql/v1/op"
    master_games_dict = {}

    current_time_iso = datetime.now(timezone.utc).isoformat()

    for locale, currency in REGIONS.items():
        print(f"\n--- Starting scan for region: {locale} ({currency}) ---")

        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "x-apollo-operation-name": "categoryGridRetrieve",
            "x-psn-store-locale-override": locale,
            "apollographql-client-name": "@sie-ppr-web-store/app",
            "apollographql-client-version": "0.109.0",
        }

        offset = 0
        size = 100

        while True:
            print(f"[{locale}] Scanning games {offset} - {offset + size}...")

            params = {
                "operationName": "categoryGridRetrieve",
                "variables": f'{{"id":"3f772501-f6f8-49b7-abac-874a88ca4897","pageArgs":{{"size":{size},"offset":{offset}}},"sortBy":null,"filterBy":[],"facetOptions":[]}}',
                "extensions": '{"persistedQuery":{"version":1,"sha256Hash":"257713466fc3264850aa473409a29088e3a4115e6e69e9fb3e061c8dd5b9f5c6"}}',
            }

            response = requests.get(base_url, headers=headers, params=params)

            if response.status_code != 200:
                print(f"[{locale}] Download error! Status {response.status_code}")
                break

            data = response.json()

            try:
                page_info = data["data"]["categoryGridRetrieve"]["pageInfo"]
                products = data["data"]["categoryGridRetrieve"]["products"]

                if not products:
                    break

                for game in products:
                    game_id = game.get("id")
                    if not game_id:
                        continue

                    name = game.get("name", "Unknown title")
                    platforms = ", ".join(game.get("platforms", []))

                    price_info = game.get("price", {})
                    base_price = price_info.get("basePrice") if price_info else None
                    discount_price = (
                        price_info.get("discountedPrice", base_price)
                        if price_info
                        else None
                    )

                    cover_url = ""
                    for media in game.get("media", []):
                        role = media.get("role")
                        if role == "MASTER":
                            cover_url = media.get("url", "")
                            break
                        elif role == "PORTRAIT_BANNER" and cover_url == "":
                            cover_url = media.get("url", "")

                    if game_id not in master_games_dict:
                        master_games_dict[game_id] = {
                            "game_id": game_id,
                            "title": name,
                            "platforms": platforms,
                            "cover_url": cover_url,
                            "prices": {},
                            "last_seen": current_time_iso,
                        }
                    else:
                        if locale == "en-US":
                            master_games_dict[game_id]["title"] = name
                            if cover_url:
                                master_games_dict[game_id]["cover_url"] = cover_url

                    country_code = locale.split("-")[1]
                    master_games_dict[game_id]["prices"][country_code] = {
                        "base": base_price,
                        "discount": discount_price,
                        "currency": currency,
                    }

                if page_info.get("isLast", False):
                    print(f"[{locale}] Reached the end of the list.")
                    break

                offset += size
                time.sleep(random.uniform(1.5, 3.5))

            except KeyError as e:
                print(f"Data parsing error: missing key {e}")
                break

    games_to_insert = list(master_games_dict.values())
    print(f"\nPrepared {len(games_to_insert)} unique games for database upload.")

    batch_size = 500
    for i in range(0, len(games_to_insert), batch_size):
        batch = games_to_insert[i : i + batch_size]
        try:
            supabase.table("deals").upsert(batch, on_conflict="game_id").execute()
            print(f"Sent batch: from {i} to {i + len(batch)}")
        except Exception as e:
            print(f"Error sending batch {i}: {e}")

    print("\nStarting database cleanup (removing expired deals)...")

    try:
        yesterday_iso = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()

        cleanup_response = (
            supabase.table("deals")
            .delete()
            .lt("last_seen", yesterday_iso)
            .eq("is_wishlisted", False)
            .execute()
        )

        deleted_count = len(cleanup_response.data) if cleanup_response.data else 0
        print(
            f"Cleanup complete. Removed {deleted_count} expired deals from the database."
        )

    except Exception as e:
        print(f"Cleanup error: {e}")

    print("\nAll done! System is up to date.")


if __name__ == "__main__":
    scrape_multi_region_deals()
