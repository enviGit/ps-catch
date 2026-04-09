import { useState, useEffect } from "react";
import { Search, Heart, Filter, Globe, LogOut } from "lucide-react";
import { supabase } from "./supabase";
import AuthModal from "./AuthModal";

const REGIONS = {
  US: {
    label: "USD (United States)",
    currency: "USD",
    maxSlider: 150,
    step: 1,
  },
  GB: {
    label: "GBP (United Kingdom)",
    currency: "GBP",
    maxSlider: 120,
    step: 1,
  },
  DE: { label: "EUR (Europe)", currency: "EUR", maxSlider: 150, step: 1 },
  PL: { label: "PLN (Poland)", currency: "PLN", maxSlider: 500, step: 5 },
};

const parsePrice = (priceStr) => {
  if (!priceStr) return 0;
  const numStr = priceStr.replace(/[^0-9,.]/g, "").replace(",", ".");
  return parseFloat(numStr) || 0;
};

const calculateDiscount = (basePrice, currentPrice) => {
  if (basePrice === 0 || basePrice === currentPrice) return 0;
  return Math.round((1 - currentPrice / basePrice) * 100);
};

function App() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [wishlist, setWishlist] = useState(new Set());

  const [activeRegion, setActiveRegion] = useState(() => {
    const savedRegion = localStorage.getItem("pscatch_region");
    return savedRegion && REGIONS[savedRegion] ? savedRegion : "US";
  });

  const [maxPrice, setMaxPrice] = useState(REGIONS[activeRegion].maxSlider);
  const [minDiscount, setMinDiscount] = useState(0);
  const [platform, setPlatform] = useState("All");

  useEffect(() => {
    localStorage.setItem("pscatch_region", activeRegion);
    setMaxPrice(REGIONS[activeRegion].maxSlider);
  }, [activeRegion]);

  useEffect(() => {
    fetchDeals();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchDeals() {
    setLoading(true);
    const { data, error } = await supabase
      .from("deals")
      .select("*")
      .order("title", { ascending: true });

    if (error) {
      console.error("Fetch error:", error);
    } else {
      setGames(data || []);
    }
    setLoading(false);
  }

  const getDisplayTitle = (game) => {
    return game.title;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const toggleWishlist = (gameId) => {
    setWishlist((prev) => {
      const newWish = new Set(prev);
      newWish.has(gameId) ? newWish.delete(gameId) : newWish.add(gameId);
      return newWish;
    });
  };

  const currentRegionConfig = REGIONS[activeRegion];
  const safeMaxPrice = maxPrice === "" ? 0 : maxPrice;
  const safeMinDiscount = minDiscount === "" ? 0 : minDiscount;

  const filteredGames = games.filter((game) => {
    const displayTitle = getDisplayTitle(game).toLowerCase();
    if (!displayTitle.includes(searchQuery.toLowerCase())) return false;
    if (platform !== "All" && !game.platforms?.includes(platform)) return false;

    const priceData = game.prices?.[activeRegion];
    if (!priceData || !priceData.discount) return false;

    const currentPriceNum = parsePrice(priceData.discount);
    const basePriceNum = parsePrice(priceData.base);
    const discountPercent = calculateDiscount(basePriceNum, currentPriceNum);

    if (currentPriceNum > safeMaxPrice) return false;
    if (discountPercent < safeMinDiscount) return false;

    return true;
  });

  const priceFillPercentage =
    (safeMaxPrice / currentRegionConfig.maxSlider) * 100;

  const sliderThumbClasses = `
    appearance-none h-2 rounded-full outline-none cursor-pointer
    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
    [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg
    [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-110
    [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:bg-white
    [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:shadow-lg
    hover:[&::-moz-range-thumb]:scale-110
  `;

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-8 text-slate-200 font-sans">
      <header className="flex flex-col md:flex-row items-center justify-between bg-slate-800 p-4 rounded-2xl shadow-lg border border-slate-700 sticky top-4 z-50 gap-4">
        <div className="flex items-center gap-6">
          <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-600 tracking-wider">
            PSCatch
          </div>
          {wishlist.size > 0 && (
            <div className="flex items-center gap-2 text-sm font-semibold text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-full border border-rose-500/20">
              <Heart className="w-4 h-4 fill-current" />
              <span>{wishlist.size}</span>
            </div>
          )}
        </div>

        <div className="flex items-center bg-slate-900 rounded-full px-4 py-2 w-full md:w-1/2 max-w-lg border-2 border-slate-700 focus-within:border-blue-500 transition-colors shadow-inner">
          <Search className="text-slate-400 w-5 h-5 mr-2" />
          <input
            type="text"
            placeholder="Search titles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none w-full text-slate-200"
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center bg-slate-900 rounded-lg px-3 py-2 border border-slate-700">
            <Globe className="w-4 h-4 text-slate-400 mr-2" />
            <select
              value={activeRegion}
              onChange={(e) => setActiveRegion(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-200 outline-none appearance-none pr-4 cursor-pointer"
            >
              {Object.entries(REGIONS).map(([key, config]) => (
                <option key={key} value={key} className="bg-slate-800">
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          {user ? (
            <div className="flex items-center gap-4">
              <span className="hidden lg:inline text-slate-400 text-sm">
                {user.email}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 bg-red-600/20 text-red-400 px-4 py-2 rounded-full hover:bg-red-600/30 transition-colors font-bold"
              >
                <LogOut className="w-4 h-4" /> <span>Logout</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-full font-bold shadow-lg active:scale-95 transition-all"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      <div className="mt-6 bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 grid grid-cols-1 md:grid-cols-3 gap-8 shadow-sm">
        <div className="flex flex-col">
          <label className="text-sm text-slate-400 mb-3 font-semibold flex items-center gap-2">
            <Filter className="w-4 h-4" /> Platform
          </label>
          <div className="flex gap-2">
            {["All", "PS4", "PS5"].map((plat) => (
              <button
                key={plat}
                onClick={() => setPlatform(plat)}
                className={`px-5 py-2 rounded-lg font-medium transition-all ${platform === plat ? "bg-blue-600 text-white shadow-md" : "bg-slate-700/50 text-slate-300 hover:bg-slate-600 border border-slate-600"}`}
              >
                {plat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-center">
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm text-slate-400 font-semibold">
              Max Price
            </label>
            <span className="text-blue-400 font-bold">
              {safeMaxPrice} {currentRegionConfig.currency}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max={currentRegionConfig.maxSlider}
            step={currentRegionConfig.step}
            value={safeMaxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            className={sliderThumbClasses}
            style={{
              background: `linear-gradient(to right, #3b82f6 ${priceFillPercentage}%, #334155 ${priceFillPercentage}%)`,
            }}
          />
        </div>

        <div className="flex flex-col justify-center">
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm text-slate-400 font-semibold">
              Min Discount
            </label>
            <span className="text-rose-400 font-bold">{safeMinDiscount}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={safeMinDiscount}
            onChange={(e) => setMinDiscount(Number(e.target.value))}
            className={sliderThumbClasses}
            style={{
              background: `linear-gradient(to right, #f43f5e ${safeMinDiscount}%, #334155 ${safeMinDiscount}%)`,
            }}
          />
        </div>
      </div>

      <main className="mt-8">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filteredGames.map((game) => {
              const priceData = game.prices?.[activeRegion];
              const currentPriceNum = parsePrice(priceData?.discount);
              const basePriceNum = parsePrice(priceData?.base);
              const discountPercent = calculateDiscount(
                basePriceNum,
                currentPriceNum,
              );
              const isLiked = wishlist.has(game.game_id);

              return (
                <div
                  key={game.game_id}
                  className="bg-slate-800 rounded-xl overflow-hidden shadow-lg hover:-translate-y-1 transition-all border border-slate-700 group flex flex-col"
                >
                  <div className="relative aspect-[3/4] overflow-hidden bg-slate-700">
                    <img
                      src={game.cover_url}
                      alt={game.title}
                      className="object-cover w-full h-full group-hover:scale-105 transition duration-700"
                    />
                    {discountPercent > 0 && (
                      <div className="absolute top-3 left-3 bg-rose-600 text-white text-xs font-black px-2.5 py-1 rounded shadow-lg border border-rose-500">
                        -{discountPercent}%
                      </div>
                    )}
                    <button
                      onClick={() => toggleWishlist(game.game_id)}
                      className="absolute top-3 right-3 p-2 bg-slate-900/60 backdrop-blur-md rounded-full border border-slate-600/50 hover:scale-110 active:scale-95 transition-all"
                    >
                      <Heart
                        className={`w-5 h-5 transition-colors ${isLiked ? "fill-rose-500 text-rose-500" : "text-slate-300"}`}
                      />
                    </button>
                  </div>

                  <div className="p-4 flex flex-col flex-grow bg-slate-800">
                    <h2 className="font-bold text-[15px] leading-tight mb-3 line-clamp-2 h-10 group-hover:text-blue-400 transition-colors">
                      {getDisplayTitle(game)}
                    </h2>
                    <div className="mt-auto pt-3 flex justify-between items-end border-t border-slate-700/50">
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-900/80 px-2 py-1 rounded border border-slate-700 uppercase">
                        {game.platforms}
                      </span>
                      <div className="text-right">
                        {basePriceNum > currentPriceNum && (
                          <div className="text-[11px] text-slate-500 line-through font-medium">
                            {priceData.base}
                          </div>
                        )}
                        <div className="text-xl font-black text-amber-400 drop-shadow-sm">
                          {priceData.discount}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}

export default App;
