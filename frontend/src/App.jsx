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

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("pscatch_theme") || "dark";
  });

  const [wishlist, setWishlist] = useState(() => {
    const saved = localStorage.getItem("pscatch_wishlist");
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

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

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const deferredMaxPrice = useDeferredValue(maxPrice);
  const deferredMinDiscount = useDeferredValue(minDiscount);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("pscatch_theme", theme);
  }, [theme]);

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

    const handleClickOutside = (event) => {
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }
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

  useEffect(() => {
    setCurrentPage(1);
    setPageInput("1");
  }, [
    deferredSearchQuery,
    activeRegion,
    deferredMaxPrice,
    deferredMinDiscount,
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

  const toggleWishlist = async (gameId) => {
    const newWish = new Set(wishlist);
    const isAdding = !newWish.has(gameId);

    if (isAdding) {
      newWish.add(gameId);
    } else {
      newWish.delete(gameId);
    }

    setWishlist(newWish);
    localStorage.setItem("pscatch_wishlist", JSON.stringify([...newWish]));

    if (user) {
      if (isAdding) {
        await supabase
          .from("wishlists")
          .insert({ user_id: user.id, game_id: gameId });
      } else {
        await supabase
          .from("wishlists")
          .delete()
          .match({ user_id: user.id, game_id: gameId });
      }
    }
  };

  const currentRegionConfig = REGIONS[activeRegion];
  const safeMaxPrice = maxPrice === "" ? 0 : maxPrice;
  const safeMinDiscount = minDiscount === "" ? 0 : minDiscount;

  const discountedWishlistGames = useMemo(() => {
    return games.filter((game) => {
      if (!wishlist.has(game.game_id)) return false;
      const priceData = game.prices?.[activeRegion];
      if (!priceData) return false;

      const isFree =
        priceData.base === "Free" || priceData.base === "Bezpłatne";
      const currentPriceNum = isFree
        ? 0
        : parsePrice(priceData.discount || priceData.base);
      const basePriceNum = isFree ? 0 : parsePrice(priceData.base);
      const discountPercent = calculateDiscount(basePriceNum, currentPriceNum);

      return discountPercent > 0;
    });
  }, [games, wishlist, activeRegion]);

  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      if (showWishlistOnly && !wishlist.has(game.game_id)) return false;

      const displayTitle = game.title;
      if (
        !displayTitle.toLowerCase().includes(deferredSearchQuery.toLowerCase())
      )
        return false;
      if (platform !== "All" && !game.platforms?.includes(platform))
        return false;

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

      const isFree =
        priceData.base === "Free" || priceData.base === "Bezpłatne";
      const currentPriceNum = isFree
        ? 0
        : parsePrice(priceData.discount || priceData.base);
      const basePriceNum = isFree ? 0 : parsePrice(priceData.base);
      const discountPercent = calculateDiscount(basePriceNum, currentPriceNum);

      if (promoFilter === "Promo" && discountPercent <= 0) return false;
      if (currentPriceNum > deferredMaxPrice) return false;
      if (discountPercent < deferredMinDiscount) return false;

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
    deferredMaxPrice,
    deferredMinDiscount,
  ]);

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

  // Rozdzielone klasy, aby Tailwind mógł poprawnie wygenerować oba suwaki
  const priceSliderClasses = `
    appearance-none h-2.5 rounded-full outline-none focus:outline-none focus:ring-0 cursor-pointer
    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
    [&::-webkit-slider-thumb]:bg-blue-600 dark:[&::-webkit-slider-thumb]:bg-white
    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(37,99,235,0.5)] dark:[&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(255,255,255,0.5)]
    [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-125
    [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5
    [&::-moz-range-thumb]:bg-blue-600 dark:[&::-moz-range-thumb]:bg-white
    [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:shadow-[0_0_10px_rgba(37,99,235,0.5)] dark:[&::-moz-range-thumb]:shadow-[0_0_10px_rgba(255,255,255,0.5)]
    hover:[&::-moz-range-thumb]:scale-125
  `;

  const discountSliderClasses = `
    appearance-none h-2.5 rounded-full outline-none focus:outline-none focus:ring-0 cursor-pointer
    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
    [&::-webkit-slider-thumb]:bg-rose-500 dark:[&::-webkit-slider-thumb]:bg-white
    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(244,63,94,0.5)] dark:[&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(255,255,255,0.5)]
    [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-125
    [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5
    [&::-moz-range-thumb]:bg-rose-500 dark:[&::-moz-range-thumb]:bg-white
    [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:shadow-[0_0_10px_rgba(244,63,94,0.5)] dark:[&::-moz-range-thumb]:shadow-[0_0_10px_rgba(255,255,255,0.5)]
    hover:[&::-moz-range-thumb]:scale-125
  `;

  return (
    <div className="min-h-screen bg-[#fcfbf9] dark:bg-[#0a0f1c] text-slate-800 dark:text-slate-200 font-sans pb-12 relative overflow-hidden [-webkit-tap-highlight-color:transparent] transition-colors duration-500">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-blue-500/10 dark:bg-blue-600/10 rounded-full blur-[100px] dark:blur-[120px] pointer-events-none"></div>

      <header className="sticky top-0 z-50 px-4 md:px-8 py-4 bg-white/70 dark:bg-[#0a0f1c]/60 backdrop-blur-2xl border-b border-black/5 dark:border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.05)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-all duration-500">
        <div className="max-w-7xl mx-auto flex flex-wrap lg:flex-nowrap items-center justify-between gap-y-4 gap-x-6">
          <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-start">
            <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-600 dark:from-blue-400 dark:to-indigo-500 tracking-tight cursor-pointer hover:opacity-80 transition-opacity drop-shadow-sm dark:drop-shadow-md">
              PSCatch
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2.5 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full border border-black/5 dark:border-white/5 backdrop-blur-md transition-all outline-none focus:outline-none focus:ring-0"
              >
                {theme === "dark" ? (
                  <Sun className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  <Moon className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </button>

              <div className="relative" ref={notificationsRef}>
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2.5 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full border border-black/5 dark:border-white/5 backdrop-blur-md transition-all relative outline-none focus:outline-none focus:ring-0"
                >
                  <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                  {discountedWishlistGames.length > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.6)] dark:shadow-[0_0_8px_rgba(244,63,94,1)] border border-white dark:border-[#0a0f1c]"></span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-3 w-80 bg-white/90 dark:bg-slate-900/80 backdrop-blur-2xl border border-black/10 dark:border-white/10 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.7)] overflow-hidden z-50">
                    <div className="p-4 border-b border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                      <h3 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wide">
                        Wishlist Deals
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Games from your list currently on sale
                      </p>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {discountedWishlistGames.length === 0 ? (
                        <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400 font-medium bg-black/5 dark:bg-black/20">
                          No active discounts right now.
                        </div>
                      ) : (
                        discountedWishlistGames.map((game) => (
                          <div
                            key={game.game_id}
                            className="p-4 border-b border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex gap-3 items-center bg-white dark:bg-black/20"
                          >
                            <img
                              src={game.cover_url}
                              alt={game.title}
                              className="w-10 h-14 object-cover rounded shadow-sm dark:shadow-md"
                            />
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-bold text-slate-800 dark:text-white truncate">
                                {game.title}
                              </h4>
                              <span className="text-rose-500 dark:text-rose-400 font-black text-sm">
                                {game.prices?.[activeRegion]?.discount}
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
                className={`flex items-center gap-2 px-4 py-2 sm:py-2.5 rounded-full font-bold text-sm transition-all duration-300 border backdrop-blur-md outline-none focus:outline-none focus:ring-0 ${
                  showWishlistOnly
                    ? "bg-rose-500 text-white border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.3)] dark:bg-rose-500/90 dark:shadow-[0_0_20px_rgba(244,63,94,0.4)]"
                    : "bg-black/5 border-black/5 text-slate-600 hover:bg-black/10 hover:text-slate-900 dark:bg-white/5 dark:border-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                }`}
              >
                <Heart
                  className={`w-4 h-4 ${showWishlistOnly ? "fill-current" : ""}`}
                />
                <span className="hidden sm:inline">Wishlist</span>
                {wishlist.size > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-black ${
                      showWishlistOnly
                        ? "bg-white/30"
                        : "bg-rose-100 text-rose-500 dark:bg-rose-500/20 dark:text-rose-400"
                    }`}
                  >
                    {wishlist.size}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center bg-black/5 dark:bg-white/5 backdrop-blur-md rounded-full px-5 py-2.5 w-full lg:max-w-md border border-black/10 dark:border-white/10 order-last lg:order-none focus-within:bg-black/10 dark:focus-within:bg-white/10 focus-within:border-blue-400 dark:focus-within:border-blue-500 focus-within:shadow-[0_0_15px_rgba(59,130,246,0.1)] dark:focus-within:shadow-[0_0_20px_rgba(59,130,246,0.15)] transition-all">
            <Search className="text-slate-500 dark:text-slate-400 w-5 h-5 mr-3" />
            <input
              type="text"
              placeholder="Search for games or add-ons..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none focus:outline-none focus:ring-0 w-full text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm sm:text-base"
            />
          </div>

          <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center bg-black/5 dark:bg-white/5 backdrop-blur-md rounded-full px-4 py-2 sm:py-2.5 border border-black/5 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
              <Globe className="w-4 h-4 text-blue-500 dark:text-blue-400 mr-2" />
              <select
                value={activeRegion}
                onChange={(e) => setActiveRegion(e.target.value)}
                className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:outline-none focus:ring-0 appearance-none pr-2 cursor-pointer"
              >
                {Object.entries(REGIONS).map(([key, config]) => (
                  <option
                    key={key}
                    value={key}
                    className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  >
                    {config.label}
                  </option>
                ))}
              </select>
            </div>

            {user ? (
              <button
                onClick={handleLogout}
                className="p-2.5 text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 bg-black/5 dark:bg-white/5 hover:bg-rose-100 dark:hover:bg-rose-500/10 rounded-full border border-black/5 dark:border-white/5 backdrop-blur-md transition-all outline-none focus:outline-none focus:ring-0"
                title="Logout"
              >
                <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            ) : (
              <button
                onClick={() => setIsAuthOpen(true)}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-600 hover:from-blue-600 hover:to-indigo-700 dark:hover:from-blue-500 dark:hover:to-indigo-500 text-white px-5 sm:px-6 py-2 sm:py-2.5 rounded-full text-sm font-bold shadow-[0_4px_15px_rgba(59,130,246,0.3)] dark:shadow-[0_0_15px_rgba(59,130,246,0.3)] border border-transparent dark:border-white/10 active:scale-95 transition-all whitespace-nowrap outline-none focus:outline-none focus:ring-0"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-8 relative z-10">
        <div className="mt-8 mb-10 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex flex-wrap gap-5">
              <div className="flex gap-1.5 bg-white/60 dark:bg-white/5 backdrop-blur-lg p-1.5 rounded-xl border border-black/5 dark:border-white/10 shadow-sm dark:shadow-lg">
                {["All", "Game", "DLC"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all outline-none focus:outline-none focus:ring-0 ${
                      typeFilter === type
                        ? "bg-white dark:bg-white/15 text-blue-600 dark:text-white shadow-sm border border-black/5 dark:border-white/10"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    {type === "Game" && <Gamepad2 className="w-4 h-4" />}
                    {type === "DLC" && <Hash className="w-4 h-4" />}
                    {type === "All" ? "Everything" : type}
                  </button>
                ))}
              </div>

              <div className="flex gap-1.5 bg-white/60 dark:bg-white/5 backdrop-blur-lg p-1.5 rounded-xl border border-black/5 dark:border-white/10 shadow-sm dark:shadow-lg">
                {["All", "Promo"].map((promo) => (
                  <button
                    key={promo}
                    onClick={() => {
                      setPromoFilter(promo);
                      if (promo === "All") setMinDiscount(0);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all outline-none focus:outline-none focus:ring-0 ${
                      promoFilter === promo
                        ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 shadow-sm dark:shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    {promo === "Promo" && <Tag className="w-4 h-4" />}
                    {promo === "All" ? "All Deals" : "On Sale"}
                  </button>
                ))}
              </div>

              <div className="flex gap-1.5 bg-white/60 dark:bg-white/5 backdrop-blur-lg p-1.5 rounded-xl border border-black/5 dark:border-white/10 shadow-sm dark:shadow-lg">
                {["All", "PS4", "PS5"].map((plat) => (
                  <button
                    key={plat}
                    onClick={() => setPlatform(plat)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all outline-none focus:outline-none focus:ring-0 ${
                      platform === plat
                        ? "bg-blue-600 text-white dark:bg-blue-600/80 border border-blue-500/50 shadow-md dark:shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    {plat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300 font-semibold bg-white/60 dark:bg-white/5 backdrop-blur-lg px-4 py-2.5 rounded-xl border border-black/5 dark:border-white/10 shadow-sm dark:shadow-lg">
              <span>Grid:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="bg-transparent outline-none focus:outline-none focus:ring-0 text-slate-900 dark:text-white font-bold cursor-pointer"
              >
                <option value={24} className="bg-white dark:bg-slate-900">
                  24 items
                </option>
                <option value={48} className="bg-white dark:bg-slate-900">
                  48 items
                </option>
                <option value={96} className="bg-white dark:bg-slate-900">
                  96 items
                </option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start bg-white/60 dark:bg-white/5 backdrop-blur-md p-2 rounded-2xl border border-black/5 dark:border-white/10 shadow-sm dark:shadow-lg">
            {ALPHABET.map((letter) => (
              <button
                key={letter}
                onClick={() => setLetterFilter(letter)}
                className={`w-9 h-9 rounded-lg text-sm font-black flex items-center justify-center transition-all outline-none focus:outline-none focus:ring-0 ${
                  letterFilter === letter
                    ? "bg-blue-600 dark:bg-blue-500 text-white shadow-md dark:shadow-[0_0_15px_rgba(59,130,246,0.5)] border border-blue-500 dark:border-blue-400/50 scale-110"
                    : "bg-transparent text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {letter}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white/60 dark:bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-black/5 dark:border-white/10 shadow-sm dark:shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-100/50 dark:bg-blue-500/5 rounded-full blur-[80px] pointer-events-none"></div>

            <div className="flex flex-col justify-center relative z-10">
              <div className="flex justify-between items-center mb-4">
                <label className="text-sm text-slate-600 dark:text-slate-300 font-bold tracking-wide uppercase">
                  Price Limit
                </label>
                <span className="text-blue-700 dark:text-white font-black bg-blue-50 dark:bg-blue-500/20 px-3 py-1 rounded-lg text-sm border border-blue-200 dark:border-blue-500/30 backdrop-blur-md">
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
                className={priceSliderClasses}
                style={{
                  background: `linear-gradient(to right, #3b82f6 ${priceFillPercentage}%, ${theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} ${priceFillPercentage}%)`,
                }}
              />
            </div>

            <div className="flex flex-col justify-center relative z-10">
              <div className="flex justify-between items-center mb-4">
                <label className="text-sm text-slate-600 dark:text-slate-300 font-bold tracking-wide uppercase">
                  Minimum Discount
                </label>
                {/* POPRAWIONY KOLOR TŁA I CZCIONKI W JASNYM TRYBIE NA ROSE */}
                <span className="text-rose-600 dark:text-white font-black bg-rose-50 dark:bg-rose-500/20 px-3 py-1 rounded-lg text-sm border border-rose-200 dark:border-rose-500/30 backdrop-blur-md">
                  {safeMinDiscount}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={safeMinDiscount}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setMinDiscount(val);
                  if (val > 0) {
                    setPromoFilter("Promo");
                  }
                }}
                className={discountSliderClasses}
                style={{
                  background: `linear-gradient(to right, #f43f5e ${safeMinDiscount}%, ${theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} ${safeMinDiscount}%)`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center text-sm font-semibold text-slate-500 dark:text-slate-400 mb-6 px-2">
          <div className="flex items-center gap-3">
            <span>
              Showing{" "}
              <strong className="text-slate-800 dark:text-white">
                {filteredGames.length}
              </strong>{" "}
              titles
            </span>
            {isSyncing && (
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-200 dark:border-blue-500/20 backdrop-blur-md shadow-sm dark:shadow-[0_0_10px_rgba(59,130,246,0.1)]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Syncing data...
                </span>
              </div>
            )}
          </div>
          {totalPages > 1 && (
            <span>
              Page{" "}
              <strong className="text-slate-800 dark:text-white">
                {validCurrentPage}
              </strong>{" "}
              of {totalPages}
            </span>
          )}
        </div>

        <main>
          {loading ? (
            <div className="flex flex-col justify-center items-center h-64 gap-6">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            </div>
          ) : paginatedGames.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-80 bg-white/60 dark:bg-white/5 backdrop-blur-lg rounded-3xl border border-black/5 dark:border-white/10 shadow-sm dark:shadow-2xl">
              <Gamepad2 className="w-20 h-20 text-slate-300 dark:text-slate-600 mb-6" />
              <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">
                Nothing found
              </h3>
              <p className="text-slate-500 dark:text-slate-400">
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
                <div className="mt-16 flex justify-center items-center gap-4 bg-white/60 dark:bg-white/5 py-3 px-4 rounded-full border border-black/5 dark:border-white/10 shadow-md dark:shadow-xl w-fit mx-auto backdrop-blur-2xl">
                  <button
                    onClick={() => changePage(validCurrentPage - 1)}
                    disabled={validCurrentPage === 1}
                    className="p-3 bg-black/5 dark:bg-white/5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-slate-600 dark:text-white border border-transparent hover:border-black/5 dark:hover:border-white/10 outline-none focus:outline-none focus:ring-0"
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
                      className="w-12 bg-transparent border-b-2 border-slate-300 dark:border-slate-600 focus:border-blue-500 text-center font-black text-lg text-slate-800 dark:text-white outline-none focus:outline-none focus:ring-0 transition-colors pb-1 hide-arrows"
                      style={{
                        WebkitAppearance: "none",
                        MozAppearance: "textfield",
                      }}
                    />
                    <span className="text-slate-500 dark:text-slate-400 font-bold">
                      / {totalPages}
                    </span>
                  </form>

                  <button
                    onClick={() => changePage(validCurrentPage + 1)}
                    disabled={validCurrentPage === totalPages}
                    className="p-3 bg-black/5 dark:bg-white/5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-slate-600 dark:text-white border border-transparent hover:border-black/5 dark:hover:border-white/10 outline-none focus:outline-none focus:ring-0"
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
