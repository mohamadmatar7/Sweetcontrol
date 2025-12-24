"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const LS_TOKEN_KEY = "sweet_admin_token";

function h(tag, props) {
  for (
    var _len = arguments.length,
      children = new Array(_len > 2 ? _len - 2 : 0),
      _key = 2;
    _key < _len;
    _key++
  ) {
    children[_key - 2] = arguments[_key];
  }
  return React.createElement.apply(React, [tag, props].concat(children));
}

function fmtDate(v) {
  try {
    if (!v) return "-";
    var d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString();
  } catch {
    return String(v || "-");
  }
}

function cls() {
  return Array.prototype.slice.call(arguments).filter(Boolean).join(" ");
}

function n(v, fallback) {
  var x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

// Normalize possible backend shapes (camelCase / snake_case / alternative fields)
function normalizeDonation(row) {
  var id = row.id ?? row.donationId ?? row.donation_id ?? row.ID;
  var name = row.name ?? row.playerName ?? row.player_name ?? row.nickname ?? "";
  var status = row.status ?? row.state ?? "";

  // Credits fields may arrive in different names
  var creditsTotal =
    row.creditsTotal ??
    row.credits_total ??
    row.credits ??
    row.totalCredits ??
    row.total_credits ??
    null;

  var creditsUsed =
    row.creditsUsed ??
    row.credits_used ??
    row.usedCredits ??
    row.used_credits ??
    null;

  var creditsRemaining =
    row.creditsRemaining ??
    row.credits_remaining ??
    row.remainingCredits ??
    row.remaining_credits ??
    null;

  var ct = n(creditsTotal, null);
  var cu = n(creditsUsed, null);
  var cr = n(creditsRemaining, null);

  // If remaining isn't provided, compute it if possible
  if (cr === null) {
    if (ct !== null && cu !== null) cr = Math.max(0, ct - cu);
    else if (ct !== null && cu === null) cr = ct;
    else cr = null;
  }

  // Amount field variants
  var amount =
    row.amountEuros ??
    row.amount_euros ??
    row.amount_eur ??
    row.amount ??
    row.euros ??
    row.eur ??
    null;

  // CreatedAt variants
  var createdAt = row.createdAt ?? row.created_at ?? row.created ?? row.timestamp ?? null;

  return {
    ...row,
    id: Number(id),
    name,
    status,
    creditsTotal: ct !== null ? ct : 0,
    creditsUsed: cu !== null ? cu : 0,
    creditsRemaining: cr !== null ? cr : 0,
    amountEuros: amount,
    createdAt,
  };
}

export default function AdminPage() {
  const [adminToken, setAdminToken] = useState("");
  const [tokenSaved, setTokenSaved] = useState(false);

  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [donations, setDonations] = useState([]);
  const [activeDonationId, setActiveDonationId] = useState(null);
  const [stats, setStats] = useState(null);

  const [selectedId, setSelectedId] = useState("");
  const [delta, setDelta] = useState(1);
  const [creditsTotal, setCreditsTotal] = useState(1);
  const [creditsUsed, setCreditsUsed] = useState(0);
  const [status, setStatus] = useState("waiting");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const pollRef = useRef(null);
  const refreshingRef = useRef(false);
  const scrollPositionRef = useRef(0);

  // Load token from localStorage / URL param
  useEffect(() => {
    try {
      var t = localStorage.getItem(LS_TOKEN_KEY) || "";
      var url = new URL(window.location.href);
      var qp = url.searchParams.get("token");
      var initial = qp || t;
      if (initial) {
        setAdminToken(initial);
        setTokenSaved(!!t);
      }
    } catch {}
  }, []);

  // Helpers
  function authHeaders() {
    return {
      "Content-Type": "application/json",
      "x-admin-token": adminToken,
    };
  }

  async function api(path, opts) {
    if (!API_BASE_URL) {
      throw new Error("Missing NEXT_PUBLIC_API_BASE_URL in env.");
    }
    if (!adminToken) {
      throw new Error("Admin token is required.");
    }

    var res = await fetch(
      API_BASE_URL + path,
      Object.assign({}, opts, {
        headers: Object.assign({}, authHeaders(), (opts && opts.headers) || {}),
        cache: "no-store",
      })
    );

    var data = null;
    try {
      data = await res.json();
    } catch {}

    if (!res.ok) {
      var msg = data && data.error ? data.error : "Request failed (" + res.status + ")";
      throw new Error(msg);
    }

    return data;
  }

  async function refresh(silent) {
    if (refreshingRef.current) return;
    refreshingRef.current = true;

    // Save scroll position before refresh
    scrollPositionRef.current = window.scrollY || document.documentElement.scrollTop;

    if (!silent) {
      setError("");
      setNotice("");
      setLoading(true);
    }

    try {
      var data = await api("/api/admin/donations", { method: "GET" });
      var statsData = await api("/api/admin/stats", { method: "GET" });

      var rows = (data && data.donations) ? data.donations : [];
      var normalized = rows.map(normalizeDonation);

      setDonations(normalized);
      setActiveDonationId((data && data.activeDonationId) ? data.activeDonationId : null);
      setStats(statsData);

      // Keep selected row inputs in sync when polling updates
      if (selectedId) {
        var found = normalized.find(function (d) { return String(d.id) === String(selectedId); });
        if (found) {
          setCreditsTotal(Number(found.creditsTotal || 0));
          setCreditsUsed(Number(found.creditsUsed || 0));
          setStatus(String(found.status || "waiting"));
        }
      }

      if (!silent) setNotice("Updated.");
    } catch (e) {
      if (!silent) setError(e.message || "Failed.");
    } finally {
      if (!silent) setLoading(false);
      refreshingRef.current = false;
      
      // Restore scroll position after refresh (only for silent refreshes to avoid jumping)
      if (silent && scrollPositionRef.current > 0) {
        requestAnimationFrame(function () {
          window.scrollTo(0, scrollPositionRef.current);
        });
      }
    }
  }

  // Auto-load + realtime polling
  useEffect(() => {
    if (!adminToken) return;

    // Initial fetch
    refresh(true);

    // Poll every 2 seconds
    if (pollRef.current) clearInterval(pollRef.current);
    if (autoRefresh) {
    pollRef.current = setInterval(function () {
      // Avoid noisy errors while typing token etc.
      refresh(true);
    }, 2000);
    }

    // Also refresh on focus/visibility
    function onFocus() {
      refresh(true);
    }
    function onVis() {
      if (!document.hidden) refresh(true);
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken, autoRefresh]);

  function saveToken() {
    setError("");
    setNotice("");
    try {
      localStorage.setItem(LS_TOKEN_KEY, adminToken);
      setTokenSaved(true);
      setNotice("Token saved locally.");
    } catch {
      setError("Failed to save token to localStorage.");
    }
  }

  function clearToken() {
    setError("");
    setNotice("");
    try {
      localStorage.removeItem(LS_TOKEN_KEY);
      setAdminToken("");
      setTokenSaved(false);
      setDonations([]);
      setActiveDonationId(null);
      setSelectedId("");
      setNotice("Token cleared.");
    } catch {
      setError("Failed to clear token.");
    }
  }

  function pickId(id) {
    setSelectedId(String(id));
    var row = donations.find(function (d) { return String(d.id) === String(id); });
    if (row) {
      setCreditsTotal(Number(row.creditsTotal || 0));
      setCreditsUsed(Number(row.creditsUsed || 0));
      setStatus(String(row.status || "waiting"));
    }
  }

  var selectedRow = useMemo(
    function () {
      return donations.find(function (d) { return String(d.id) === String(selectedId); }) || null;
    },
    [donations, selectedId]
  );

  // Calculate daily money totals from donations array
  var dailyMoneyData = useMemo(
    function () {
      var dailyTotals = {};
      donations.forEach(function (d) {
        if (d.status === "done" && d.amountEuros !== null && d.amountEuros !== undefined && d.amountEuros > 0) {
          var date = d.createdAt ? new Date(d.createdAt).toISOString().split("T")[0] : null;
          if (date) {
            if (!dailyTotals[date]) {
              dailyTotals[date] = 0;
            }
            dailyTotals[date] += Number(d.amountEuros || 0);
          }
        }
      });
      return dailyTotals;
    },
    [donations]
  );

  // Combine gamesOverTime with daily money data
  var chartData = useMemo(
    function () {
      if (!stats || !stats.gamesOverTime) return [];
      return stats.gamesOverTime.map(function (day) {
        return {
          date: day.date,
          payers: day.donations || 0,
          money: dailyMoneyData[day.date] || 0,
        };
      });
    },
    [stats, dailyMoneyData]
  );

  // Pagination calculations
  var totalPages = Math.ceil(donations.length / itemsPerPage);
  var startIndex = (currentPage - 1) * itemsPerPage;
  var endIndex = startIndex + itemsPerPage;
  var paginatedDonations = donations.slice(startIndex, endIndex);

  // Reset to page 1 when donations change significantly
  useEffect(function () {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [donations.length, currentPage, totalPages]);

  // Actions
  async function runAction(label, fn, idForBusy) {
    setError("");
    setNotice("");
    setBusyId(idForBusy || "global");
    try {
      await fn();
      setNotice(label + " ✅");
      await refresh(true);
    } catch (e) {
      setError(e.message || "Failed.");
    } finally {
      setBusyId(null);
    }
  }

  function actionAddCredits() {
    return runAction(
      "Credits updated",
      function () {
        return api("/api/admin/credits/add", {
          method: "POST",
          body: JSON.stringify({ id: Number(selectedId), delta: Number(delta) }),
        });
      },
      selectedId
    );
  }

  function actionSetTotal() {
    return runAction(
      "Credits total set",
      function () {
        return api("/api/admin/credits/set-total", {
          method: "POST",
          body: JSON.stringify({ id: Number(selectedId), creditsTotal: Number(creditsTotal) }),
        });
      },
      selectedId
    );
  }

  function actionSetUsed() {
    return runAction(
      "Credits used set",
      function () {
        return api("/api/admin/credits/set-used", {
          method: "POST",
          body: JSON.stringify({ id: Number(selectedId), creditsUsed: Number(creditsUsed) }),
        });
      },
      selectedId
    );
  }

  function actionRequeue() {
    return runAction(
      "Requeued",
      function () {
        return api("/api/admin/requeue", {
          method: "POST",
          body: JSON.stringify({ id: Number(selectedId) }),
        });
      },
      selectedId
    );
  }

  function actionSetStatus() {
    return runAction(
      "Status updated",
      function () {
        return api("/api/admin/status/set", {
          method: "POST",
          body: JSON.stringify({ id: Number(selectedId), status: status }),
        });
      },
      selectedId
    );
  }

  function actionEndActive() {
    return runAction(
      "Ended active player",
      function () {
        return api("/api/admin/player/end-active", { method: "POST" });
      },
      "global"
    );
  }

  function actionStartNext() {
    return runAction(
      "Started next player",
      function () {
        return api("/api/admin/player/start-next", { method: "POST" });
      },
      "global"
    );
  }

  function actionDeleteOne(id) {
    return runAction(
      "Deleted donation",
      function () {
        return api("/api/admin/donations/" + Number(id), { method: "DELETE" });
      },
      id
    );
  }

  function actionDeleteAll() {
    return runAction(
      "Deleted all donations",
      function () {
        return api("/api/admin/donations", { method: "DELETE" });
      },
      "global"
    );
  }

  // UI bits
  function Button(props) {
    var disabled = !!props.disabled;
    return h(
      "button",
      {
        type: props.type || "button",
        onClick: props.onClick,
        disabled: disabled,
        className: cls(
          "px-3 py-2 rounded-xl font-semibold text-sm transition",
          "border border-white/15",
          disabled ? "opacity-50 cursor-not-allowed" : "hover:opacity-90 active:scale-[0.99]",
          props.variant === "danger"
            ? "bg-red-600/20 text-red-100"
            : props.variant === "primary"
            ? "bg-gradient-to-r from-[#ffbb00] to-[#ff3b1f] text-[#1b123a] border-amber-300/40"
            : props.variant === "dark"
            ? "bg-white/10 text-white"
            : "bg-white/10 text-white",
          props.className
        ),
      },
      props.children
    );
  }

  function Input(props) {
    return h("input", {
      value: props.value,
      onChange: props.onChange,
      placeholder: props.placeholder,
      type: props.type || "text",
      className: cls(
        "w-full px-3 py-2 rounded-xl bg-white/10 text-white placeholder:text-white/40",
        "border border-white/15 outline-none focus:border-yellow-300/60",
        props.className
      ),
    });
  }

  function Select(props) {
    return h(
      "select",
      {
        value: props.value,
        onChange: props.onChange,
        className: cls(
          "w-full px-3 py-2 rounded-xl bg-white/10 text-white",
          "border border-white/15 outline-none focus:border-yellow-300/60",
          props.className
        ),
      },
      props.children
    );
  }

  function Card(props) {
    return h(
      "div",
      {
        className: cls(
          "rounded-3xl border border-white/15 bg-[#050816]/70 shadow-[0_0_50px_rgba(0,0,0,0.65)]",
          props.className
        ),
      },
      props.children
    );
  }

  return h(
    "main",
    {
      className:
        "min-h-screen bg-gradient-to-br from-[#5a3ffb] to-[#2c0f74] text-white px-4 py-8 flex justify-center",
    },
    h(
      "div",
      { className: "w-full max-w-6xl flex flex-col gap-5" },

      // Header
      h(
        Card,
        { className: "px-5 py-5 sm:px-7 sm:py-6" },
        h(
          "div",
          {
            className:
              "flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4",
          },
          h(
            "div",
            null,
            h(
              "div",
              {
                className:
                  "text-[0.7rem] uppercase tracking-[0.22em] text-white/70",
              },
              "admin panel"
            ),
            h(
              "div",
              { className: "jersey-10-regular text-3xl sm:text-4xl tracking-wide" },
              "sweet control"
            )
          ),
          h(
            "div",
            { className: "w-full sm:w-[360px] flex flex-col gap-2" },
            h(
              "div",
              {
                className:
                  "text-[0.7rem] uppercase tracking-[0.22em] text-white/70",
              },
              "admin token"
            ),
            h(
              "div",
              { className: "flex gap-2" },
              h(Input, {
                value: adminToken,
                onChange: function (e) {
                  setAdminToken(e.target.value);
                },
                placeholder: "Paste ADMIN_TOKEN here",
              }),
              h(
                Button,
                { variant: "dark", onClick: saveToken, disabled: !adminToken },
                tokenSaved ? "Saved" : "Save"
              ),
              h(Button, { variant: "dark", onClick: clearToken }, "Clear")
            )
          )
        ),
        h(
          "div",
          {
            className:
              "mt-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between",
          },
          h(
            "div",
            { className: "text-sm text-white/80" },
            "Active donation: ",
            h(
              "b",
              { className: "text-yellow-300" },
              activeDonationId ? "#" + activeDonationId : "-"
            )
          ),
          h(
            "div",
            { className: "flex gap-2 flex-wrap" },
            h(
              "label",
              { className: "flex items-center gap-2 bg-white/10 px-3 rounded-xl cursor-pointer select-none border border-white/15 hover:bg-white/20 transition-colors" },
              h("input", {
                type: "checkbox",
                checked: autoRefresh,
                onChange: function (e) { setAutoRefresh(e.target.checked); },
                className: "accent-yellow-400 w-4 h-4 cursor-pointer"
              }),
              h("span", { className: "text-sm font-medium" }, "Auto-refresh")
            ),
            h(
              Button,
              { variant: "dark", onClick: function(){ refresh(false); }, disabled: loading || !adminToken },
              loading ? "Loading..." : "Refresh"
            ),
            h(
              Button,
              { variant: "dark", onClick: actionStartNext, disabled: !adminToken || busyId },
              "Start next"
            ),
            h(
              Button,
              { variant: "danger", onClick: actionEndActive, disabled: !adminToken || busyId },
              "End active"
            ),
            h(
              Button,
              { variant: "danger", onClick: actionDeleteAll, disabled: !adminToken || busyId },
              "Delete all"
            )
          )
        ),
        error
          ? h(
              "div",
              {
                className:
                  "mt-4 rounded-2xl border border-red-400/40 bg-red-600/10 px-4 py-3 text-sm text-red-100",
              },
              error
            )
          : null,
        notice
          ? h(
              "div",
              {
                className:
                  "mt-4 rounded-2xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-50",
              },
              notice
            )
          : null
      ),

      // Metrics Section
      stats ? h(
        Card,
        { className: "px-5 py-5 sm:px-7 sm:py-6" },
        h(
          "div",
          { className: "mb-4" },
          h(
            "div",
            {
              className:
                "text-[0.7rem] uppercase tracking-[0.22em] text-white/70",
            },
            "quick metrics"
          ),
          h(
            "div",
            { className: "jersey-10-regular text-2xl sm:text-3xl tracking-wide" },
            "Overview"
          )
        ),
        h(
          "div",
          { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6" },
          h(
            "div",
            { className: "bg-white/5 border border-white/10 rounded-2xl p-4" },
            h("div", { className: "text-xs uppercase tracking-[0.18em] text-white/60 mb-1" }, "Total Donated"),
            h("div", { className: "text-3xl font-bold text-emerald-400" }, "€" + (stats.totalDonated || 0).toFixed(2))
          ),
          h(
            "div",
            { className: "bg-white/5 border border-white/10 rounded-2xl p-4" },
            h("div", { className: "text-xs uppercase tracking-[0.18em] text-white/60 mb-1" }, "Total Plays"),
            h("div", { className: "text-3xl font-bold text-blue-400" }, String(stats.totalPlays || 0))
          ),
          h(
            "div",
            { className: "bg-white/5 border border-white/10 rounded-2xl p-4" },
            h("div", { className: "text-xs uppercase tracking-[0.18em] text-white/60 mb-1" }, "Total Players"),
            h("div", { className: "text-3xl font-bold text-purple-400" }, String(stats.totalPlayers || 0))
          ),
          h(
            "div",
            { className: "bg-white/5 border border-white/10 rounded-2xl p-4" },
            h("div", { className: "text-xs uppercase tracking-[0.18em] text-white/60 mb-1" }, "Avg per Player"),
            h("div", { className: "text-3xl font-bold text-yellow-400" }, 
              stats.totalPlayers > 0 
                ? "€" + (stats.totalDonated / stats.totalPlayers).toFixed(2)
                : "€0.00"
            )
          )
        ),
        h(
          "div",
          { className: "bg-white/5 border border-white/10 rounded-2xl p-4" },
          h("div", { className: "text-xs uppercase tracking-[0.18em] text-white/60 mb-3" }, "Completed Donations Over Time"),
          chartData && chartData.length > 0
            ? h(
                "div",
                { className: "space-y-4" },
                h(
                  "div",
                  { className: "overflow-x-auto -mx-4 px-4" },
                  h(
                    "div",
                    { className: "flex items-end gap-3 h-56 relative pt-8 pb-6 min-w-max" },
                    chartData.map(function (day, idx) {
                    var maxPayers = Math.max.apply(Math, chartData.map(function (d) { return d.payers; }));
                    var maxMoney = Math.max.apply(Math, chartData.map(function (d) { return d.money; }));
                    var globalMax = Math.max(maxPayers, maxMoney);
                    
                    var payerHeight = globalMax > 0 ? (day.payers / globalMax) * 100 : 0;
                    var moneyHeight = globalMax > 0 ? (day.money / globalMax) * 100 : 0;
                    
                    // Format date for display
                    var dateObj = new Date(day.date);
                    var dateStr = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    
                  return h(
                    "div",
                    {
                      key: idx,
                        className: "flex flex-col justify-end items-center h-full relative group",
                        style: { minWidth: "60px", flex: "1 1 0" },
                      },
                      // Date label at the bottom
                      h(
                        "div",
                        {
                          className: "absolute -bottom-6 text-[10px] text-white/60 whitespace-nowrap",
                        },
                        dateStr
                      ),
                      
                      // Bars container (side-by-side)
                      h(
                        "div",
                        {
                          className: "flex items-end justify-center gap-0.5 h-full w-full px-0.5",
                        },
                        // Money Bar Column
                        h(
                          "div",
                          {
                            className: "flex flex-col justify-end items-center h-full flex-1 min-w-0",
                            style: { width: "50%" },
                          },
                          // Label
                          day.money > 0 ? h(
                            "div",
                            {
                              className: "mb-1 text-[10px] text-emerald-300 font-semibold whitespace-nowrap",
                            },
                            "€" + day.money.toFixed(2)
                          ) : null,
                          // Bar
                          h(
                            "div",
                            {
                              className: "w-full bg-gradient-to-t from-emerald-500 to-emerald-300 rounded-t hover:from-emerald-400 hover:to-emerald-200 transition-colors",
                              style: { height: moneyHeight + "%", minHeight: moneyHeight > 0 ? "4px" : "0" },
                              title: day.date + ": €" + day.money.toFixed(2),
                            }
                          )
                        ),
                        // Payers Bar Column
                        h(
                          "div",
                          {
                            className: "flex flex-col justify-end items-center h-full flex-1 min-w-0",
                            style: { width: "50%" },
                          },
                          // Label
                          day.payers > 0 ? h(
                            "div",
                            {
                              className: "mb-1 text-[10px] text-blue-300 font-semibold whitespace-nowrap",
                            },
                            day.payers
                          ) : null,
                          // Bar
                          h(
                            "div",
                            {
                              className: "w-full bg-gradient-to-t from-blue-500 to-blue-300 rounded-t hover:from-blue-400 hover:to-blue-200 transition-colors",
                              style: { height: payerHeight + "%", minHeight: payerHeight > 0 ? "4px" : "0" },
                              title: day.date + ": " + day.payers + " payers",
                    }
                          )
                        )
                      )
                  );
                })
                  )
                ),
                h(
                  "div",
                  { className: "flex justify-center gap-6 text-xs text-white/60 mt-8" },
                  h(
                    "div",
                    { className: "flex items-center gap-2" },
                    h("div", { className: "w-3 h-3 bg-emerald-400 rounded" }, null),
                    h("span", null, "Money (€)")
                  ),
                  h(
                    "div",
                    { className: "flex items-center gap-2" },
                    h("div", { className: "w-3 h-3 bg-blue-400 rounded" }, null),
                    h("span", null, "Payers")
                  )
                )
              )
            : h("div", { className: "text-sm text-white/60 py-8 text-center" }, "No data yet")
        )
      ) : null,

      // Main layout
      h(
        "div",
        { className: "grid grid-cols-1 lg:grid-cols-[1.2fr,0.8fr] gap-5" },

        // Left: table
        h(
          Card,
          { className: "p-4 sm:p-5" },
          h(
            "div",
            { className: "flex items-center justify-between gap-3 mb-3" },
            h(
              "div",
              null,
              h(
                "div",
                {
                  className:
                    "text-[0.7rem] uppercase tracking-[0.22em] text-white/70",
                },
                "donations"
              ),
              h("div", { className: "text-lg font-semibold" }, "Queue & Players")
            ),
            h(
              "div",
              { className: "text-sm text-white/70" },
              "Total: ",
              h("b", { className: "text-white" }, String(donations.length))
            )
          ),

          h(
            "div",
            { className: "overflow-x-auto rounded-2xl border border-white/10" },
            h(
              "table",
              { className: "w-full text-sm" },
              h(
                "thead",
                { className: "bg-white/10 text-white/80" },
                h(
                  "tr",
                  null,
                  h("th", { className: "text-left p-3 whitespace-nowrap" }, "ID"),
                  h("th", { className: "text-left p-3 whitespace-nowrap" }, "Name"),
                  h("th", { className: "text-left p-3 whitespace-nowrap" }, "Status"),
                  h("th", { className: "text-left p-3 whitespace-nowrap" }, "Remaining"),
                  h("th", { className: "text-left p-3 whitespace-nowrap" }, "Total"),
                  h("th", { className: "text-left p-3 whitespace-nowrap" }, "Used"),
                  h("th", { className: "text-left p-3 whitespace-nowrap" }, "Amount"),
                  h("th", { className: "text-left p-3 whitespace-nowrap" }, "Created"),
                  h("th", { className: "text-right p-3 whitespace-nowrap" }, "Actions")
                )
              ),
              h(
                "tbody",
                null,
                paginatedDonations.length === 0
                  ? h(
                      "tr",
                      null,
                      h(
                        "td",
                        {
                          colSpan: 9,
                          className: "p-4 text-center text-white/60",
                        },
                        "No donations."
                      )
                    )
                  : paginatedDonations.map(function (d) {
                      var isSelected = String(selectedId) === String(d.id);
                      var isActiveRow =
                        Number(activeDonationId) === Number(d.id) || d.status === "active";
                      
                      // Color coding: green if donated, yellow if not
                      var hasDonated = d.amountEuros !== null && d.amountEuros !== undefined && d.amountEuros > 0;
                      var rowBgColor = hasDonated 
                        ? "bg-emerald-500/10 hover:bg-emerald-500/15" 
                        : "bg-yellow-500/10 hover:bg-yellow-500/15";

                      return h(
                        "tr",
                        {
                          key: d.id,
                          className: cls(
                            "border-t border-white/10 transition-colors",
                            rowBgColor,
                            isSelected ? "!bg-purple-500/20 ring-2 ring-purple-400/40" : "",
                            isActiveRow ? "ring-2 ring-blue-400/40" : ""
                          ),
                          onClick: function (e) {
                            pickId(d.id);
                          },
                          style: { cursor: "pointer" },
                        },
                        h("td", { className: "p-3 font-semibold text-white whitespace-nowrap" }, "#" + d.id),
                        h("td", { className: "p-3 whitespace-nowrap" }, d.name || "-"),
                        h("td", { className: "p-3 whitespace-nowrap" }, d.status || "-"),
                        h("td", { className: "p-3 whitespace-nowrap" }, String(d.creditsRemaining ?? 0)),
                        h("td", { className: "p-3 whitespace-nowrap" }, String(d.creditsTotal ?? 0)),
                        h("td", { className: "p-3 whitespace-nowrap" }, String(d.creditsUsed ?? 0)),
                        h(
                          "td",
                          { className: "p-3 whitespace-nowrap" },
                          d.amountEuros !== null && d.amountEuros !== undefined
                            ? "€" + String(d.amountEuros)
                            : "-"
                        ),
                        h("td", { className: "p-3 whitespace-nowrap text-white/70" }, fmtDate(d.createdAt)),
                        h(
                          "td",
                          { className: "p-3 text-right whitespace-nowrap" },
                          h(
                            "div",
                            { className: "flex justify-end gap-2" },
                            h(
                              Button,
                              {
                                variant: "dark",
                                onClick: function (e) {
                                  e.stopPropagation();
                                  pickId(d.id);
                                },
                              },
                              "Select"
                            ),
                            h(
                              Button,
                              {
                                variant: "danger",
                                disabled: !!busyId,
                                onClick: function (e) {
                                  e.stopPropagation();
                                  actionDeleteOne(d.id);
                                },
                              },
                              busyId === String(d.id) ? "Deleting..." : "Delete"
                            )
                          )
                        )
                      );
                    })
              )
            )
          ),

          h(
            "div",
            { className: "mt-3 flex flex-col sm:flex-row items-center justify-between gap-3" },
            h(
              "div",
              { className: "text-xs text-white/60" },
            "Auto-updating every 2s. Click any row to select it on the right."
            ),
            totalPages > 1 ? h(
              "div",
              { className: "flex items-center gap-2" },
              h(
                Button,
                {
                  variant: "dark",
                  disabled: currentPage === 1,
                  onClick: function () {
                    setCurrentPage(function (p) { return Math.max(1, p - 1); });
                  },
                  className: "px-2 py-1 text-xs",
                },
                "← Prev"
              ),
              h(
                "div",
                { className: "text-xs text-white/70 px-2" },
                "Page " + currentPage + " of " + totalPages
              ),
              h(
                Button,
                {
                  variant: "dark",
                  disabled: currentPage >= totalPages,
                  onClick: function () {
                    setCurrentPage(function (p) { return Math.min(totalPages, p + 1); });
                  },
                  className: "px-2 py-1 text-xs",
                },
                "Next →"
              )
            ) : null
          )
        ),

        // Right: controls panel
        h(
          Card,
          { className: "p-4 sm:p-5" },
          h(
            "div",
            { className: "mb-3" },
            h(
              "div",
              {
                className:
                  "text-[0.7rem] uppercase tracking-[0.22em] text-white/70",
              },
              "actions"
            ),
            h("div", { className: "text-lg font-semibold" }, "Manage selected donation")
          ),

          h(
            "div",
            { className: "space-y-3" },

            h(
              "div",
              null,
              h("div", { className: "text-xs text-white/70 mb-1" }, "Selected donation ID"),
              h(Input, {
                value: selectedId,
                onChange: function (e) {
                  setSelectedId(e.target.value);
                },
                placeholder: "e.g. 12",
                type: "number",
              })
            ),

            selectedRow
              ? h(
                  "div",
                  { className: "rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm" },
                  h("div", { className: "text-white/70 text-xs uppercase tracking-[0.18em]" }, "preview"),
                  h(
                    "div",
                    { className: "mt-1 flex flex-col gap-1" },
                    h("div", null, h("span", { className: "text-white/70" }, "Name: "), h("b", null, selectedRow.name || "-")),
                    h("div", null, h("span", { className: "text-white/70" }, "Status: "), h("b", null, selectedRow.status || "-")),
                    h(
                      "div",
                      null,
                      h("span", { className: "text-white/70" }, "Credits: "),
                      h("b", null, String(selectedRow.creditsRemaining || 0)),
                      " remaining / ",
                      h("b", null, String(selectedRow.creditsTotal || 0)),
                      " total / ",
                      h("b", null, String(selectedRow.creditsUsed || 0)),
                      " used"
                    )
                  )
                )
              : h("div", { className: "text-sm text-white/60" }, "Select a row from the table (or enter an ID)."),

            // Credits delta
            h(
              "div",
              { className: "grid grid-cols-1 sm:grid-cols-2 gap-3" },
              h(
                "div",
                null,
                h("div", { className: "text-xs text-white/70 mb-1" }, "Add / remove credits (delta)"),
                h(Input, {
                  value: String(delta),
                  onChange: function (e) {
                    setDelta(Number(e.target.value));
                  },
                  type: "number",
                  placeholder: "e.g. 1 or -1",
                })
              ),
              h(
                "div",
                { className: "flex items-end" },
                h(
                  Button,
                  {
                    variant: "primary",
                    className: "w-full",
                    disabled: !adminToken || !selectedId || !!busyId,
                    onClick: actionAddCredits,
                  },
                  "Apply delta"
                )
              )
            ),

            // Set totals
            h(
              "div",
              { className: "grid grid-cols-1 sm:grid-cols-2 gap-3" },
              h(
                "div",
                null,
                h("div", { className: "text-xs text-white/70 mb-1" }, "Set credits total"),
                h(Input, {
                  value: String(creditsTotal),
                  onChange: function (e) {
                    setCreditsTotal(Number(e.target.value));
                  },
                  type: "number",
                })
              ),
              h(
                "div",
                { className: "flex items-end" },
                h(
                  Button,
                  {
                    variant: "dark",
                    className: "w-full",
                    disabled: !adminToken || !selectedId || !!busyId,
                    onClick: actionSetTotal,
                  },
                  "Set total"
                )
              )
            ),

            h(
              "div",
              { className: "grid grid-cols-1 sm:grid-cols-2 gap-3" },
              h(
                "div",
                null,
                h("div", { className: "text-xs text-white/70 mb-1" }, "Set credits used"),
                h(Input, {
                  value: String(creditsUsed),
                  onChange: function (e) {
                    setCreditsUsed(Number(e.target.value));
                  },
                  type: "number",
                })
              ),
              h(
                "div",
                { className: "flex items-end" },
                h(
                  Button,
                  {
                    variant: "dark",
                    className: "w-full",
                    disabled: !adminToken || !selectedId || !!busyId,
                    onClick: actionSetUsed,
                  },
                  "Set used"
                )
              )
            ),

            // Status + requeue
            h(
              "div",
              { className: "grid grid-cols-1 sm:grid-cols-2 gap-3" },
              h(
                "div",
                null,
                h("div", { className: "text-xs text-white/70 mb-1" }, "Set status"),
                h(
                  Select,
                  {
                    value: status,
                    onChange: function (e) {
                      setStatus(e.target.value);
                    },
                  },
                  h("option", { value: "created" }, "created"),
                  h("option", { value: "waiting" }, "waiting"),
                  h("option", { value: "active" }, "active"),
                  h("option", { value: "done" }, "done")
                )
              ),
              h(
                "div",
                { className: "flex items-end gap-2" },
                h(
                  Button,
                  {
                    variant: "primary",
                    className: "w-full",
                    disabled: !adminToken || !selectedId || !!busyId,
                    onClick: actionSetStatus,
                  },
                  "Update"
                ),
                h(
                  Button,
                  {
                    variant: "dark",
                    className: "w-full",
                    disabled: !adminToken || !selectedId || !!busyId,
                    onClick: actionRequeue,
                  },
                  "Requeue"
                )
              )
            )
          )
        )
      ),

      h(
        "div",
        { className: "text-center text-xs text-white/50 pt-2" },
        "Admin endpoints are protected by your backend ADMIN_TOKEN. This page stores token only in your browser (localStorage)."
      )
    )
  );
}
