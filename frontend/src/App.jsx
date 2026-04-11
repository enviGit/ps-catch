import { useState, useEffect, useRef, useMemo, useDeferredValue } from "react";
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
  Sun,
  Moon,
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

  const [showWishlistOnly, setShowWishlistOnly] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationsRef = useRef(null);

  const [theme, setTheme] = useState(
    () => localStorage.getItem("pscatch_theme") || "dark",
  );

  const [wishlist, setWishlist] = useState(() => {
    const saved = localStorage.getItem("pscatch_wishlist");
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const [activeRegion, setActiveRegion] = useState(() => {
    const saved = localStorage.getItem("pscatch_region");
    return saved && REGIONS[saved] ? saved : "US";
  });

  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(REGIONS[activeRegion].maxSlider);
  const [minDiscount, setMinDiscount] = useState(0);
  const [platform, setPlatform] = useState("All");
  const [promoFilter, setPromoFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [letterFilter, setLetterFilter] = useState("All");

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(24);
  const [pageInput, setPageInput] = useState("1");

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const deferredMinPrice = useDeferredValue(minPrice);
  const deferredMaxPrice = useDeferredValue(maxPrice);
  const deferredMinDiscount = useDeferredValue(minDiscount);

  useEffect(() => {
    const root = document.documentElement;
    theme === "dark"
      ? root.classList.add("dark")
      : root.classList.remove("dark");
    localStorage.setItem("pscatch_theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("pscatch_region", activeRegion);
    setMaxPrice(REGIONS[activeRegion].maxSlider);
    setMinPrice(0);
  }, [activeRegion]);

  useEffect(() => {
    fetchDeals();
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => setUser(session?.user ?? null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) =>
      setUser(session?.user ?? null),
    );

    const handleClickOutside = (e) => {
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(e.target)
      )
        setShowNotifications(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      subscription.unsubscribe();
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchUserWishlist = async () => {
      const { data, error } = await supabase
        .from("wishlists")
        .select("game_id");
      if (!error && data) {
        const dbWishlist = new Set(data.map((item) => item.game_id));
        const localWishlist = JSON.parse(
          localStorage.getItem("pscatch_wishlist") || "[]",
        );
        const mergedWishlist = new Set([...dbWishlist, ...localWishlist]);
        setWishlist(mergedWishlist);
        localStorage.setItem(
          "pscatch_wishlist",
          JSON.stringify([...mergedWishlist]),
        );
        for (const gameId of localWishlist) {
          if (!dbWishlist.has(gameId)) {
            await supabase
              .from("wishlists")
              .insert({ user_id: user.id, game_id: gameId });
          }
        }
      }
    };
    fetchUserWishlist();
  }, [user]);

  const toggleWishlist = async (gameId) => {
    const newWish = new Set(wishlist);
    const isAdding = !newWish.has(gameId);
    isAdding ? newWish.add(gameId) : newWish.delete(gameId);
    setWishlist(newWish);
    localStorage.setItem("pscatch_wishlist", JSON.stringify([...newWish]));
    if (user) {
      if (isAdding)
        await supabase
          .from("wishlists")
          .insert({ user_id: user.id, game_id: gameId });
      else
        await supabase
          .from("wishlists")
          .delete()
          .match({ user_id: user.id, game_id: gameId });
    }
  };

  async function fetchDeals() {
    setLoading(true);
    const { data, count, error } = await supabase
      .from("deals")
      .select("*", { count: "exact" })
      .range(0, 999);
    if (error) {
      setLoading(false);
      return;
    }
    let acc = [...(data || [])];
    setGames(customSort([...acc]));
    setLoading(false);
    if (count > 1000) {
      setIsSyncing(true);
      const reqs = [];
      for (let i = 1000; i < count; i += 1000)
        reqs.push(
          supabase
            .from("deals")
            .select("*")
            .range(i, i + 999),
        );
      const res = await Promise.all(reqs);
      res.forEach((r) => r.data && acc.push(...r.data));
      setGames(customSort([...acc]));
      setIsSyncing(false);
    }
  }

  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      if (showWishlistOnly && !wishlist.has(game.game_id)) return false;
      if (!game.title.toLowerCase().includes(deferredSearchQuery.toLowerCase()))
        return false;
      if (platform !== "All" && !game.platforms?.includes(platform))
        return false;
      if (letterFilter !== "All") {
        const char = game.title
          .replace(/^['"\[\]\s\-]+/, "")
          .charAt(0)
          .toUpperCase();
        if (letterFilter === "#" ? /[A-Z]/.test(char) : char !== letterFilter)
          return false;
      }
      if (typeFilter !== "All" && game.type !== typeFilter) return false;
      const p = game.prices?.[activeRegion];
      if (!p) return false;
      const isFree = p.base === "Free" || p.base === "Bezpłatne";
      const curr = isFree ? 0 : parsePrice(p.discount || p.base);
      const disc = isFree ? 0 : calculateDiscount(parsePrice(p.base), curr);
      if (promoFilter === "Promo" && disc <= 0) return false;
      if (curr < deferredMinPrice || curr > deferredMaxPrice) return false;
      if (disc < deferredMinDiscount) return false;
      return true;
    });
  }, [
    games,
    showWishlistOnly,
    wishlist,
    deferredSearchQuery,
    platform,
    letterFilter,
    typeFilter,
    activeRegion,
    promoFilter,
    deferredMinPrice,
    deferredMaxPrice,
    deferredMinDiscount,
  ]);

  const currentRegionConfig = REGIONS[activeRegion];
  const totalPages = Math.max(
    1,
    Math.ceil(filteredGames.length / itemsPerPage),
  );
  const validPage = Math.min(currentPage, totalPages);
  const paginatedGames = filteredGames.slice(
    (validPage - 1) * itemsPerPage,
    validPage * itemsPerPage,
  );

  const discountedWishlistGames = useMemo(() => {
    return games.filter(
      (g) =>
        wishlist.has(g.game_id) &&
        calculateDiscount(
          parsePrice(g.prices?.[activeRegion]?.base),
          parsePrice(
            g.prices?.[activeRegion]?.discount ||
              g.prices?.[activeRegion]?.base,
          ),
        ) > 0,
    );
  }, [games, wishlist, activeRegion]);

  const changePage = (p) => {
    setCurrentPage(p);
    setPageInput(p.toString());
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handlePageSubmit = (e) => {
    e.preventDefault();
    const num = parseInt(pageInput);
    if (num >= 1 && num <= totalPages) {
      setCurrentPage(num);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else setPageInput(currentPage.toString());
  };

  const thumbStyle = `
    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white
    [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:cursor-pointer
    [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full
    [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-lg
    [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:cursor-pointer
  `;

  return (
    <div className="min-h-screen bg-[#fcfbf9] dark:bg-[#0a0f1c] text-slate-800 dark:text-slate-200 font-sans pb-12 transition-colors duration-500 overflow-x-hidden">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-blue-500/10 dark:bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />

      <header className="sticky top-0 z-50 px-4 md:px-8 py-4 bg-white/70 dark:bg-[#0a0f1c]/60 backdrop-blur-2xl border-b border-black/5 dark:border-white/10 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap lg:flex-nowrap items-center justify-between gap-4">
          <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-start">
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-600 dark:from-blue-400 dark:to-indigo-500 tracking-tight">
              PSCatch
            </h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2.5 text-slate-500 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 rounded-full border border-black/5 dark:border-white/5 transition-all"
              >
                {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <div className="relative" ref={notificationsRef}>
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2.5 text-slate-500 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 rounded-full border border-black/5 dark:border-white/5 relative"
                >
                  <Bell size={20} />
                  {discountedWishlistGames.length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,1)]"></span>
                  )}
                </button>
                {showNotifications && (
                  <div className="absolute top-full right-[-60px] sm:right-0 mt-3 w-[calc(100vw-2rem)] sm:w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-black/5 dark:border-white/10 overflow-hidden z-50">
                    <div className="p-4 bg-slate-50 dark:bg-white/5 border-b border-black/5 dark:border-white/5 font-bold uppercase text-xs">
                      Wishlist Deals
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {discountedWishlistGames.length === 0 ? (
                        <div className="p-6 text-center text-sm text-slate-400">
                          No active discounts.
                        </div>
                      ) : (
                        discountedWishlistGames.map((g) => (
                          <div
                            key={g.game_id}
                            className="p-4 border-b border-black/5 dark:border-white/5 flex gap-3 items-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                          >
                            <img
                              src={g.cover_url}
                              className="w-10 h-14 object-cover rounded"
                            />
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-bold truncate dark:text-white">
                                {g.title}
                              </h4>
                              <span className="text-rose-500 font-black">
                                {g.prices?.[activeRegion]?.discount}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowWishlistOnly(!showWishlistOnly)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm border transition-all ${showWishlistOnly ? "bg-rose-500 text-white border-rose-400 shadow-lg" : "bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5 text-slate-600 dark:text-slate-300"}`}
              >
                <Heart size={16} fill={showWishlistOnly ? "white" : "none"} />{" "}
                <span className="hidden sm:inline">Wishlist</span>
              </button>
            </div>
          </div>

          <div className="flex items-center bg-black/5 dark:bg-white/5 backdrop-blur-md rounded-full px-5 py-2.5 w-full lg:max-w-md border border-black/10 dark:border-white/10 focus-within:border-blue-400">
            <Search className="text-slate-400 mr-3" size={18} />
            <input
              type="text"
              placeholder="Search games..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none w-full dark:text-white"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-black/5 dark:bg-white/5 rounded-full px-4 py-2 border border-black/5 dark:border-white/10">
              <Globe size={16} className="text-blue-500 mr-2" />
              <select
                value={activeRegion}
                onChange={(e) => setActiveRegion(e.target.value)}
                className="bg-transparent text-sm font-bold outline-none appearance-none dark:text-white pr-2 cursor-pointer"
              >
                {Object.entries(REGIONS).map(([k, v]) => (
                  <option key={k} value={k} className="dark:bg-slate-900">
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            {user ? (
              <button
                onClick={handleLogout}
                className="p-2.5 text-slate-500 hover:text-rose-500 transition-colors"
              >
                <LogOut size={20} />
              </button>
            ) : (
              <button
                onClick={() => setIsAuthOpen(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-full font-bold shadow-lg shadow-blue-500/20 whitespace-nowrap active:scale-95 transition-all"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-8">
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex bg-white/60 dark:bg-white/5 p-1.5 rounded-xl border border-black/5 dark:border-white/10 shadow-sm">
            {["All", "Game", "DLC"].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${typeFilter === t ? "bg-white dark:bg-white/15 text-blue-600 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex bg-white/60 dark:bg-white/5 p-1.5 rounded-xl border border-black/5 dark:border-white/10 shadow-sm">
            {["All", "Promo"].map((p) => (
              <button
                key={p}
                onClick={() => {
                  setPromoFilter(p);
                  if (p === "All") setMinDiscount(0);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${promoFilter === p ? "bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
              >
                {p === "Promo" ? "On Sale" : "All deals"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-8 bg-white/60 dark:bg-white/5 p-2 rounded-2xl border border-black/5 dark:border-white/10 shadow-sm">
          {ALPHABET.map((l) => (
            <button
              key={l}
              onClick={() => setLetterFilter(l)}
              className={`w-9 h-9 rounded-lg text-sm font-black transition-all ${letterFilter === l ? "bg-blue-600 text-white scale-110 shadow-lg" : "text-slate-400 hover:bg-black/5 dark:hover:bg-white/10"}`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* DUAL SLIDERS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
          <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-black/5 dark:border-white/10 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <label className="text-xs font-black uppercase tracking-widest text-slate-500">
                Price Range
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={minPrice}
                  onChange={(e) =>
                    setMinPrice(Math.min(maxPrice, Number(e.target.value)))
                  }
                  className="w-16 bg-black/5 dark:bg-white/10 rounded-lg py-1 text-center font-bold text-sm outline-none focus:ring-1 focus:ring-blue-500 dark:text-white"
                />
                <span className="text-slate-400">—</span>
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) =>
                    setMaxPrice(Math.max(minPrice, Number(e.target.value)))
                  }
                  className="w-16 bg-black/5 dark:bg-white/10 rounded-lg py-1 text-center font-bold text-sm outline-none focus:ring-1 focus:ring-blue-500 dark:text-white"
                />
                <span className="text-blue-600 font-black text-xs ml-1">
                  {currentRegionConfig.currency}
                </span>
              </div>
            </div>
            <div className="relative h-2 mx-1 flex items-center">
              <div className="absolute w-full h-full bg-black/10 dark:bg-white/10 rounded-full" />
              <div
                className="absolute h-full bg-blue-600 rounded-full shadow-[0_0_12px_rgba(37,99,235,0.4)]"
                style={{
                  left: `${(minPrice / currentRegionConfig.maxSlider) * 100}%`,
                  right: `${100 - (maxPrice / currentRegionConfig.maxSlider) * 100}%`,
                }}
              />
              <input
                type="range"
                min="0"
                max={currentRegionConfig.maxSlider}
                value={minPrice}
                onChange={(e) =>
                  setMinPrice(Math.min(maxPrice, Number(e.target.value)))
                }
                className={`absolute w-full h-2 bg-transparent appearance-none pointer-events-none outline-none focus:ring-0 ${thumbStyle} [&::-webkit-slider-thumb]:bg-blue-600`}
              />
              <input
                type="range"
                min="0"
                max={currentRegionConfig.maxSlider}
                value={maxPrice}
                onChange={(e) =>
                  setMaxPrice(Math.max(minPrice, Number(e.target.value)))
                }
                className={`absolute w-full h-2 bg-transparent appearance-none pointer-events-none outline-none focus:ring-0 ${thumbStyle} [&::-webkit-slider-thumb]:bg-blue-600`}
              />
            </div>
          </div>

          <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-black/5 dark:border-white/10 shadow-sm">
            <div className="flex justify-between items-center mb-6 px-1">
              <label className="text-xs font-black uppercase tracking-widest text-slate-500">
                Min Discount
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={minDiscount}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setMinDiscount(v);
                    if (v > 0) setPromoFilter("Promo");
                  }}
                  className="w-16 bg-black/5 dark:bg-white/10 rounded-lg py-1 text-center font-bold text-sm outline-none focus:ring-1 focus:ring-rose-500 dark:text-white"
                />
                <span className="text-rose-600 font-black text-sm">%</span>
              </div>
            </div>
            <div className="relative h-2 mx-1 flex items-center">
              <div className="absolute w-full h-full bg-black/10 dark:bg-white/10 rounded-full" />
              <div
                className="absolute h-full bg-rose-500 rounded-full shadow-[0_0_12px_rgba(244,63,94,0.4)]"
                style={{ width: `${minDiscount}%` }}
              />
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={minDiscount}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setMinDiscount(v);
                  if (v > 0) setPromoFilter("Promo");
                }}
                className={`absolute w-full h-2 bg-transparent appearance-none pointer-events-auto outline-none focus:ring-0 ${thumbStyle} [&::-webkit-slider-thumb]:bg-rose-500`}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center text-sm font-semibold text-slate-500 dark:text-slate-400 mb-6 px-2">
          <div className="flex items-center gap-3">
            <span>
              Showing{" "}
              <strong className="text-slate-900 dark:text-white">
                {filteredGames.length}
              </strong>{" "}
              items
            </span>
            {isSyncing && (
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-200 dark:border-blue-500/20 backdrop-blur-md shadow-sm">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-xs font-bold uppercase">Syncing...</span>
              </div>
            )}
          </div>
          {totalPages > 1 && (
            <span>
              Page{" "}
              <strong className="text-slate-900 dark:text-white">
                {validPage}
              </strong>{" "}
              of {totalPages}
            </span>
          )}
        </div>

        <main>
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="animate-spin text-blue-500" size={48} />
            </div>
          ) : paginatedGames.length === 0 ? (
            <div className="text-center py-20 bg-white/40 dark:bg-white/5 rounded-[2rem] border border-dashed border-slate-300 dark:border-white/10 shadow-inner">
              <Gamepad2 className="mx-auto mb-4 text-slate-400" size={48} />
              <h3 className="text-xl font-bold dark:text-white">
                Nothing found
              </h3>
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
                <div className="mt-16 flex justify-center items-center gap-4 bg-white/60 dark:bg-white/5 py-3 px-4 rounded-full border border-black/5 dark:border-white/10 shadow-xl w-fit mx-auto backdrop-blur-2xl">
                  <button
                    onClick={() => changePage(validPage - 1)}
                    disabled={validPage === 1}
                    className="p-2 text-slate-600 dark:text-white disabled:opacity-30 outline-none"
                  >
                    <ChevronLeft />
                  </button>
                  <form
                    onSubmit={handlePageSubmit}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="number"
                      value={pageInput}
                      onChange={(e) => setPageInput(e.target.value)}
                      onBlur={handlePageSubmit}
                      className="w-12 bg-transparent border-b-2 border-slate-300 dark:border-slate-600 text-center font-black dark:text-white outline-none focus:border-blue-500 transition-colors"
                    />
                    <span className="text-slate-400 font-bold">
                      / {totalPages}
                    </span>
                  </form>
                  <button
                    onClick={() => changePage(validPage + 1)}
                    disabled={validPage === totalPages}
                    className="p-2 text-slate-600 dark:text-white disabled:opacity-30 outline-none"
                  >
                    <ChevronRight />
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
