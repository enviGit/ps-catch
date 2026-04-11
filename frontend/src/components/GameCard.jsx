import { Heart } from "lucide-react";
import { parsePrice, calculateDiscount } from "../utils";

export default function GameCard({
  game,
  activeRegion,
  isLiked,
  onToggleWishlist,
}) {
  const priceData = game.prices?.[activeRegion];
  const isFree = priceData?.base === "Free" || priceData?.base === "Bezpłatne";
  const currentPriceNum = isFree
    ? 0
    : parsePrice(priceData?.discount || priceData?.base);
  const basePriceNum = isFree ? 0 : parsePrice(priceData?.base);
  const discountPercent = calculateDiscount(basePriceNum, currentPriceNum);

  return (
    <div className="bg-white dark:bg-[#111827] rounded-2xl overflow-hidden hover:-translate-y-2 hover:shadow-[0_10px_30px_rgba(59,130,246,0.15)] transition-all duration-300 border border-black/5 dark:border-white/5 group flex flex-col">
      <div className="relative aspect-[3/4] overflow-hidden bg-slate-100 dark:bg-[#1f2937]">
        <img
          src={game.cover_url}
          alt={game.title}
          loading="lazy"
          className="object-cover w-full h-full group-hover:scale-105 group-hover:opacity-90 transition duration-500"
        />
        {discountPercent > 0 && !isFree && (
          <div className="absolute top-3 left-3 bg-rose-500 text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-lg">
            -{discountPercent}%
          </div>
        )}
        <button
          onClick={() => onToggleWishlist(game.game_id)}
          className={`absolute top-3 right-3 p-2.5 backdrop-blur-md rounded-full transition-all duration-300 active:scale-90 outline-none focus:outline-none focus:ring-0 ${
            isLiked
              ? "bg-rose-500/20 border border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.4)] hover:bg-rose-500/30"
              : "bg-white/40 dark:bg-black/40 border border-black/10 dark:border-white/10 hover:bg-white/60 dark:hover:bg-black/60"
          }`}
        >
          <Heart
            className={`w-4 h-4 transition-all duration-300 ${
              isLiked
                ? "fill-rose-500 text-rose-500 scale-110"
                : "text-slate-800 dark:text-white"
            }`}
          />
        </button>
      </div>

      <div className="p-4 flex flex-col flex-grow bg-gradient-to-b from-white to-[#fcfbf9] dark:from-[#111827] dark:to-[#0a0f1c]">
        <h2 className="font-bold text-[14px] leading-snug mb-3 line-clamp-2 h-10 text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {game.title}
        </h2>
        <div className="mt-auto pt-3 flex justify-between items-end border-t border-black/5 dark:border-white/5">
          <span className="text-[10px] font-bold text-slate-500 uppercase bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md max-w-[50%] truncate">
            {game.platforms}
          </span>
          <div className="text-right flex flex-col items-end">
            {basePriceNum > currentPriceNum && !isFree && (
              <span className="text-[11px] text-slate-400 dark:text-slate-500 line-through font-semibold mb-0.5">
                {priceData.base}
              </span>
            )}
            <span
              className={`text-lg font-black tracking-tight ${isFree ? "text-emerald-500 dark:text-emerald-400" : "text-slate-900 dark:text-white"}`}
            >
              {priceData?.discount || priceData?.base}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
