import { useState, useEffect } from "react";
import {
  Search,
  Heart,
  Globe,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Tag,
  Gamepad2,
  Hash,
  Loader2,
} from "lucide-react";
import { supabase } from "./supabase";
import AuthModal from "./AuthModal";
import GameCard from "./components/GameCard";
import {
  REGIONS,
  ALPHABET,
  parsePrice,
  calculateDiscount,
  customSort,
} from "./utils";

function App() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
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
  const [promoFilter, setPromoFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [letterFilter, setLetterFilter] = useState("All");

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(24);
  const [pageInput, setPageInput] = useState("1");

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

  useEffect(() => {
    setCurrentPage(1);
    setPageInput("1");
  }, [
    searchQuery,
    activeRegion,
    maxPrice,
    minDiscount,
    platform,
    promoFilter,
    typeFilter,
    letterFilter,
    itemsPerPage,
  ]);

  async function fetchDeals() {
    setLoading(true);

    const {
      data: firstChunk,
      count,
      error,
    } = await supabase
      .from("deals")
      .select("*", { count: "exact" })
      .range(0, 999);

    if (error) {
      console.error("Fetch error:", error);
      setLoading(false);
      return;
    }

    let accumulatedGames = [...(firstChunk || [])];
    setGames(customSort([...accumulatedGames]));
    setLoading(false);

    if (count && count > 1000) {
      setIsSyncing(true);
      const requests = [];

      for (let i = 1000; i < count; i += 1000) {
        requests.push(
          supabase
            .from("deals")
            .select("*")
            .range(i, i + 999),
        );
      }

      const results = await Promise.all(requests);
      results.forEach((res) => {
        if (res.data) accumulatedGames.push(...res.data);
      });

      setGames(customSort([...accumulatedGames]));
      setIsSyncing(false);
    }
  }

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
    const displayTitle = game.title;

    if (!displayTitle.toLowerCase().includes(searchQuery.toLowerCase()))
      return false;
    if (platform !== "All" && !game.platforms?.includes(platform)) return false;

    if (letterFilter !== "All") {
      const cleanTitle = displayTitle.replace(/^['"\[\]\s\-]+/, "");
      const firstChar = cleanTitle.charAt(0).toUpperCase();

      if (letterFilter === "#") {
        if (/[A-Z]/.test(firstChar)) return false;
      } else {
        if (firstChar !== letterFilter) return false;
      }
    }

    if (typeFilter !== "All" && game.type !== typeFilter) return false;

    const priceData = game.prices?.[activeRegion];
    if (!priceData) return false;

    const isFree = priceData.base === "Free" || priceData.base === "Bezpłatne";
    const currentPriceNum = isFree
      ? 0
      : parsePrice(priceData.discount || priceData.base);
    const basePriceNum = isFree ? 0 : parsePrice(priceData.base);
    const discountPercent = calculateDiscount(basePriceNum, currentPriceNum);

    if (promoFilter === "Promo" && discountPercent <= 0) return false;
    if (currentPriceNum > safeMaxPrice) return false;
    if (discountPercent < safeMinDiscount) return false;

    return true;
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredGames.length / itemsPerPage),
  );
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedGames = filteredGames.slice(
    (validCurrentPage - 1) * itemsPerPage,
    validCurrentPage * itemsPerPage,
  );

  const handlePageSubmit = (e) => {
    e.preventDefault();
    const pageNum = parseInt(pageInput);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setPageInput(currentPage.toString());
    }
  };

  const changePage = (newPage) => {
    setCurrentPage(newPage);
    setPageInput(newPage.toString());
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const priceFillPercentage =
    (safeMaxPrice / currentRegionConfig.maxSlider) * 100;
  const sliderThumbClasses = `appearance-none h-2 rounded-full outline-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-110 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:shadow-lg hover:[&::-moz-range-thumb]:scale-110`;

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-8 text-slate-200 font-sans">
      {/* HEADER */}
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

        <div className="flex items-center bg-slate-900 rounded-full px-4 py-2 w-full md:w-1/3 border-2 border-slate-700 focus-within:border-blue-500 transition-colors shadow-inner">
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

      {/* FILTERS */}
      <div className="mt-6 space-y-4">
        <div className="flex flex-wrap gap-4 items-center justify-between bg-slate-800/80 p-4 rounded-xl border border-slate-700">
          <div className="flex flex-wrap gap-4">
            <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
              {["All", "Game", "DLC"].map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`px-4 py-1.5 rounded-md text-sm font-semibold flex items-center gap-2 transition-all ${typeFilter === type ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200"}`}
                >
                  {type === "Game" && <Gamepad2 className="w-4 h-4" />}
                  {type === "DLC" && <Hash className="w-4 h-4" />}
                  {type === "All" ? "All Types" : type}
                </button>
              ))}
            </div>

            <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
              {["All", "Promo"].map((promo) => (
                <button
                  key={promo}
                  onClick={() => setPromoFilter(promo)}
                  className={`px-4 py-1.5 rounded-md text-sm font-semibold flex items-center gap-2 transition-all ${promoFilter === promo ? "bg-rose-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200"}`}
                >
                  {promo === "Promo" && <Tag className="w-4 h-4" />}
                  {promo === "All" ? "All Deals" : "On Sale"}
                </button>
              ))}
            </div>

            <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
              {["All", "PS4", "PS5"].map((plat) => (
                <button
                  key={plat}
                  onClick={() => setPlatform(plat)}
                  className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${platform === plat ? "bg-slate-700 text-white shadow-md" : "text-slate-400 hover:text-slate-200"}`}
                >
                  {plat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-400 font-semibold">
            <span>Show:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1 outline-none text-slate-200"
            >
              <option value={24}>24</option>
              <option value={48}>48</option>
              <option value={96}>96</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 justify-center">
          {ALPHABET.map((letter) => (
            <button
              key={letter}
              onClick={() => setLetterFilter(letter)}
              className={`w-8 h-8 rounded text-sm font-bold flex items-center justify-center transition-colors ${letterFilter === letter ? "bg-indigo-500 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"}`}
            >
              {letter}
            </button>
          ))}
        </div>

        <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700/50 grid grid-cols-1 md:grid-cols-2 gap-8 shadow-sm">
          <div className="flex flex-col justify-center">
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm text-slate-400 font-semibold flex items-center gap-2">
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
              <span className="text-rose-400 font-bold">
                {safeMinDiscount}%
              </span>
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
      </div>

      <div className="mt-6 mb-4 flex justify-between items-center text-sm font-semibold text-slate-400">
        <div className="flex items-center gap-3">
          <span>
            Found{" "}
            <strong className="text-slate-200">{filteredGames.length}</strong>{" "}
            items
          </span>
          {isSyncing && (
            <div className="flex items-center gap-2 text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-md border border-blue-500/20">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-xs">Syncing background data...</span>
            </div>
          )}
        </div>
        {totalPages > 1 && (
          <span>
            Page {validCurrentPage} of {totalPages}
          </span>
        )}
      </div>

      {/* GAMES GRID */}
      <main>
        {loading ? (
          <div className="flex flex-col justify-center items-center h-64 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : paginatedGames.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 bg-slate-800/30 rounded-2xl border border-slate-700/50 border-dashed">
            <Gamepad2 className="w-16 h-16 text-slate-600 mb-4" />
            <h3 className="text-xl font-bold text-slate-400">No games found</h3>
            <p className="text-slate-500 mt-2">
              Try adjusting your filters or search query.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
              {paginatedGames.map((game) => (
                <GameCard
                  key={game.game_id}
                  game={game}
                  activeRegion={activeRegion}
                  isLiked={wishlist.has(game.game_id)}
                  onToggleWishlist={toggleWishlist}
                />
              ))}
            </div>

            {/* PAGINATION */}
            {totalPages > 1 && (
              <div className="mt-12 flex justify-center items-center gap-4 bg-slate-800/50 py-4 px-6 rounded-2xl border border-slate-700/50 w-fit mx-auto">
                <button
                  onClick={() => changePage(validCurrentPage - 1)}
                  disabled={validCurrentPage === 1}
                  className="p-2 bg-slate-700 rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-slate-200"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <form
                  onSubmit={handlePageSubmit}
                  className="flex items-center gap-2"
                >
                  <span className="text-slate-400 text-sm font-semibold">
                    Page
                  </span>
                  <input
                    type="number"
                    min="1"
                    max={totalPages}
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    onBlur={handlePageSubmit}
                    className="w-14 bg-slate-900 border border-slate-600 rounded-md px-2 py-1 text-center font-bold text-slate-200 outline-none focus:border-blue-500 hide-arrows"
                    style={{
                      WebkitAppearance: "none",
                      MozAppearance: "textfield",
                    }}
                  />
                  <span className="text-slate-400 text-sm font-semibold">
                    of {totalPages}
                  </span>
                </form>

                <button
                  onClick={() => changePage(validCurrentPage + 1)}
                  disabled={validCurrentPage === totalPages}
                  className="p-2 bg-slate-700 rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-slate-200"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}

export default App;
