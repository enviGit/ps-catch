import { Heart } from "lucide-react";
import { parsePrice, calculateDiscount } from "../utils";

export default function GameCard({ game, activeRegion, isLiked, onToggleWishlist }) {
  const priceData = game.prices?.[activeRegion];
  const isFree = priceData?.base === "Free" || priceData?.base === "Bezpłatne";
  const currentPriceNum = isFree ? 0 : parsePrice(priceData?.discount || priceData?.base);
  const basePriceNum = isFree ? 0 : parsePrice(priceData?.base);
  const discountPercent = calculateDiscount(basePriceNum, currentPriceNum);

  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden shadow-lg hover:-translate-y-1 transition-all border border-slate-700 group flex flex-col">
      <div className="relative aspect-[3/4] overflow-hidden bg-slate-700">
        <img
          src={game.cover_url}
          alt={game.title}
          loading="lazy"
          className="object-cover w-full h-full group-hover:scale-105 transition duration-700"
        />
        {discountPercent > 0 && !isFree && (
          <div className="absolute top-3 left-3 bg-rose-600 text-white text-xs font-black px-2.5 py-1 rounded shadow-lg border border-rose-500">
            -{discountPercent}%
          </div>
        )}
        <button
          onClick={() => onToggleWishlist(game.game_id)}
          className="absolute top-3 right-3 p-2 bg-slate-900/60 backdrop-blur-md rounded-full border border-slate-600/50 hover:scale-110 active:scale-95 transition-all"
        >
          <Heart
            className={`w-5 h-5 transition-colors ${isLiked ? "fill-rose-500 text-rose-500" : "text-slate-300"}`}
          />
        </button>
      </div>

      <div className="p-4 flex flex-col flex-grow bg-slate-800">
        <h2 className="font-bold text-[14px] leading-tight mb-3 line-clamp-2 h-10 group-hover:text-blue-400 transition-colors">
          {game.title}
        </h2>
        <div className="mt-auto pt-3 flex justify-between items-end border-t border-slate-700/50">
          <span className="text-[10px] font-bold text-slate-400 bg-slate-900/80 px-2 py-1 rounded border border-slate-700 uppercase max-w-[50%] truncate">
            {game.platforms}
          </span>
          <div className="text-right">
            {basePriceNum > currentPriceNum && !isFree && (
              <div className="text-[11px] text-slate-500 line-through font-medium">
                {priceData.base}
              </div>
            )}
            <div className={`text-xl font-black drop-shadow-sm ${isFree ? 'text-emerald-400' : 'text-amber-400'}`}>
              {priceData?.discount || priceData?.base}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}