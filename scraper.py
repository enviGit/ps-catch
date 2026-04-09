import os
import random
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

REGIONS = {"pl-PL": "PLN", "de-DE": "EUR", "en-GB": "GBP", "en-US": "USD"}


def scrape_multi_region_deals():
    base_url = "https://web.np.playstation.com/api/graphql/v1/op"
    master_games_dict = {}
    current_time_iso = datetime.now(timezone.utc).isoformat()

    for locale, currency in REGIONS.items():
        print(f"\n--- Scanning region: {locale} ---")
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
            params = {
                "operationName": "categoryGridRetrieve",
                "variables": f'{{"id":"3f772501-f6f8-49b7-abac-874a88ca4897","pageArgs":{{"size":{size},"offset":{offset}}}}}',
                "extensions": '{"persistedQuery":{"version":1,"sha256Hash":"257713466fc3264850aa473409a29088e3a4115e6e69e9fb3e061c8dd5b9f5c6"}}',
            }

            try:
                response = requests.get(base_url, headers=headers, params=params)
                data = response.json()

                if "data" not in data:
                    print(f"API Error for {locale}: {data}")
                    break

                products = data["data"]["categoryGridRetrieve"]["products"]
                if not products:
                    break

                for game in products:
                    concept_id = game.get("conceptId") or game.get("id")
                    name = game.get("name", "Unknown")
                    country_code = locale.split("-")[1].upper()

                    if concept_id not in master_games_dict:
                        master_games_dict[concept_id] = {
                            "game_id": concept_id,
                            "title": name,
                            "platforms": ", ".join(game.get("platforms", [])),
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
                        master_games_dict[concept_id]["title"] = name

                    price_info = game.get("price", {})
                    master_games_dict[concept_id]["prices"][country_code] = {
                        "base": price_info.get("basePrice"),
                        "discount": price_info.get("discountedPrice"),
                        "currency": currency,
                    }

                if data["data"]["categoryGridRetrieve"]["pageInfo"].get("isLast"):
                    break

                offset += size
                time.sleep(random.uniform(1, 2))

            except Exception as e:
                print(f"Download error at offset {offset}: {e}")
                break

    games_list = list(master_games_dict.values())
    print(f"Prepared {len(games_list)} unique games.")

    for i in range(0, len(games_list), 500):
        batch = games_list[i : i + 500]
        try:
            supabase.table("deals").upsert(batch, on_conflict="game_id").execute()
            print(f"Batch {i} sent.")
        except Exception as e:
            print(f"Batch write error: {e}")

    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    supabase.table("deals").delete().lt("last_seen", yesterday).execute()
    print("Database cleanup completed.")


if __name__ == "__main__":
    scrape_multi_region_deals()
