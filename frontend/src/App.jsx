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
  Bell,
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
  const [showWishlistOnly, setShowWishlistOnly] = useState(false);

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
    showWishlistOnly,
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
    if (showWishlistOnly && !wishlist.has(game.game_id)) return false;

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
  const sliderThumbClasses = `appearance-none h-2.5 rounded-full outline-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(59,130,246,0.5)] [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-125`;

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-slate-200 font-sans pb-12">
      <header className="sticky top-0 z-50 px-4 md:px-8 py-4 bg-[#0a0f1c]/80 backdrop-blur-xl border-b border-white/5 shadow-2xl transition-all">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-start">
            <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500 tracking-tight cursor-pointer hover:opacity-80 transition-opacity">
              PSCatch
            </div>

            <div className="flex items-center gap-3">
              <button className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.8)]"></span>
              </button>

              <button
                onClick={() => setShowWishlistOnly(!showWishlistOnly)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold transition-all duration-300 ${
                  showWishlistOnly
                    ? "bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.4)]"
                    : "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Heart
                  className={`w-4 h-4 ${showWishlistOnly ? "fill-current" : ""}`}
                />
                <span className="hidden sm:inline">Wishlist</span>
                {wishlist.size > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${showWishlistOnly ? "bg-white/20" : "bg-rose-500/20 text-rose-400"}`}
                  >
                    {wishlist.size}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center bg-black/40 rounded-full px-5 py-2.5 w-full md:max-w-md border border-white/10 focus-within:border-blue-500 focus-within:shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-all">
            <Search className="text-slate-400 w-5 h-5 mr-3" />
            <input
              type="text"
              placeholder="Search for games or add-ons..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none w-full text-white placeholder-slate-500"
            />
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
            <div className="flex items-center bg-black/40 rounded-full px-4 py-2 border border-white/10">
              <Globe className="w-4 h-4 text-blue-400 mr-2" />
              <select
                value={activeRegion}
                onChange={(e) => setActiveRegion(e.target.value)}
                className="bg-transparent text-sm font-semibold text-slate-200 outline-none appearance-none pr-2 cursor-pointer"
              >
                {Object.entries(REGIONS).map(([key, config]) => (
                  <option key={key} value={key} className="bg-slate-900">
                    {config.label}
                  </option>
                ))}
              </select>
            </div>

            {user ? (
              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-full transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={() => setIsAuthOpen(true)}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-6 py-2 rounded-full font-bold shadow-[0_0_15px_rgba(59,130,246,0.3)] active:scale-95 transition-all"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="mt-8 mb-10 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex flex-wrap gap-3">
              <div className="flex bg-black/30 p-1 rounded-xl border border-white/5">
                {["All", "Game", "DLC"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${typeFilter === type ? "bg-white/10 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
                  >
                    {type === "Game" && <Gamepad2 className="w-4 h-4" />}
                    {type === "DLC" && <Hash className="w-4 h-4" />}
                    {type === "All" ? "Everything" : type}
                  </button>
                ))}
              </div>

              <div className="flex bg-black/30 p-1 rounded-xl border border-white/5">
                {["All", "Promo"].map((promo) => (
                  <button
                    key={promo}
                    onClick={() => setPromoFilter(promo)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${promoFilter === promo ? "bg-emerald-500/20 text-emerald-400" : "text-slate-500 hover:text-slate-300"}`}
                  >
                    {promo === "Promo" && <Tag className="w-4 h-4" />}
                    {promo === "All" ? "All Deals" : "On Sale"}
                  </button>
                ))}
              </div>

              <div className="flex bg-black/30 p-1 rounded-xl border border-white/5">
                {["All", "PS4", "PS5"].map((plat) => (
                  <button
                    key={plat}
                    onClick={() => setPlatform(plat)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${platform === plat ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-300"}`}
                  >
                    {plat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm text-slate-400 font-semibold bg-black/30 px-4 py-2 rounded-xl border border-white/5">
              <span>Grid:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="bg-transparent outline-none text-white font-bold cursor-pointer"
              >
                <option value={24} className="bg-slate-900">
                  24 items
                </option>
                <option value={48} className="bg-slate-900">
                  48 items
                </option>
                <option value={96} className="bg-slate-900">
                  96 items
                </option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start">
            {ALPHABET.map((letter) => (
              <button
                key={letter}
                onClick={() => setLetterFilter(letter)}
                className={`w-9 h-9 rounded-lg text-sm font-black flex items-center justify-center transition-all ${letterFilter === letter ? "bg-blue-600 text-white shadow-[0_4px_10px_rgba(59,130,246,0.3)] scale-110" : "bg-black/20 text-slate-500 hover:bg-white/10 hover:text-white"}`}
              >
                {letter}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-black/20 p-6 rounded-2xl border border-white/5">
            <div className="flex flex-col justify-center">
              <div className="flex justify-between items-center mb-4">
                <label className="text-sm text-slate-400 font-bold tracking-wide uppercase">
                  Price Limit
                </label>
                <span className="text-white font-black bg-blue-500/20 px-3 py-1 rounded-lg text-sm border border-blue-500/30">
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
                  background: `linear-gradient(to right, #3b82f6 ${priceFillPercentage}%, #1e293b ${priceFillPercentage}%)`,
                }}
              />
            </div>

            <div className="flex flex-col justify-center">
              <div className="flex justify-between items-center mb-4">
                <label className="text-sm text-slate-400 font-bold tracking-wide uppercase">
                  Minimum Discount
                </label>
                <span className="text-white font-black bg-emerald-500/20 px-3 py-1 rounded-lg text-sm border border-emerald-500/30">
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
                className={sliderThumbClasses
                  .replace("bg-blue-500", "bg-emerald-500")
                  .replace(
                    "shadow-[0_0_10px_rgba(59,130,246,0.5)]",
                    "shadow-[0_0_10px_rgba(16,185,129,0.5)]",
                  )}
                style={{
                  background: `linear-gradient(to right, #10b981 ${safeMinDiscount}%, #1e293b ${safeMinDiscount}%)`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center text-sm font-semibold text-slate-500 mb-6 px-2">
          <div className="flex items-center gap-3">
            <span>
              Showing{" "}
              <strong className="text-white">{filteredGames.length}</strong>{" "}
              titles
            </span>
            {isSyncing && (
              <div className="flex items-center gap-2 text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-xs font-bold">Syncing data...</span>
              </div>
            )}
          </div>
          {totalPages > 1 && (
            <span>
              Page <strong className="text-white">{validCurrentPage}</strong> of{" "}
              {totalPages}
            </span>
          )}
        </div>

        <main>
          {loading ? (
            <div className="flex flex-col justify-center items-center h-64 gap-6">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            </div>
          ) : paginatedGames.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-80 bg-black/20 rounded-3xl border border-white/5 border-dashed">
              <Gamepad2 className="w-20 h-20 text-slate-700 mb-6" />
              <h3 className="text-2xl font-black text-white mb-2">
                Nothing found
              </h3>
              <p className="text-slate-500">
                Try adjusting your filters, searching for something else, or
                clear the wishlist view.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
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

              {totalPages > 1 && (
                <div className="mt-16 flex justify-center items-center gap-4 bg-black/40 py-3 px-4 rounded-full border border-white/10 w-fit mx-auto backdrop-blur-sm">
                  <button
                    onClick={() => changePage(validCurrentPage - 1)}
                    disabled={validCurrentPage === 1}
                    className="p-3 bg-white/5 rounded-full hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-white"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <form
                    onSubmit={handlePageSubmit}
                    className="flex items-center gap-3 px-4"
                  >
                    <input
                      type="number"
                      min="1"
                      max={totalPages}
                      value={pageInput}
                      onChange={(e) => setPageInput(e.target.value)}
                      onBlur={handlePageSubmit}
                      className="w-12 bg-transparent border-b-2 border-slate-600 focus:border-blue-500 text-center font-black text-lg text-white outline-none transition-colors pb-1 hide-arrows"
                      style={{
                        WebkitAppearance: "none",
                        MozAppearance: "textfield",
                      }}
                    />
                    <span className="text-slate-500 font-bold">
                      / {totalPages}
                    </span>
                  </form>

                  <button
                    onClick={() => changePage(validCurrentPage + 1)}
                    disabled={validCurrentPage === totalPages}
                    className="p-3 bg-white/5 rounded-full hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-white"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}

export default App;
