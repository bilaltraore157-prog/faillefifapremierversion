// ====== CONFIGURATION ET VARIABLES INITIALES ======
let appState = {
    initialCapital: 30000,
    dailyGoal: 10000,
    bets: JSON.parse(localStorage.getItem('fifa_track_bets')) || []
};

let capitalChartInstance = null;

// Liste des stratégies principales pour les filtres
const AVAILABLE_STRATEGIES = [
    "Victoire", "Total Plus de", "Total Moins de", 
    "Les 2 équipes marquent : Oui", "Les 2 équipes marquent : Non", "Total Individuel"
];

// Mapping des sélections exactes selon la méthode choisie (image_aef7e5.png)
const EXACT_SELECTIONS = {
    "Victoire": ["Victoire Domicile (V1)", "Victoire Extérieur (V2)", "Match Nul (X)"],
    "Total Plus de": ["Total +1.5", "Total +2.5", "Total +3.5", "Total +4.5", "Total +5.5"],
    "Total Moins de": ["Total -1.5", "Total -2.5", "Total -3.5", "Total -4.5", "Total -5.5"],
    "Les 2 équipes marquent : Oui": ["Les 2 marquent : Oui"],
    "Les 2 équipes marquent : Non": ["Les 2 marquent : Non"],
    "Total Individuel": [
        "Total Équipe A +0.5", "Total Équipe A +1.5", "Total Équipe A +2.5",
        "Total Équipe B +0.5", "Total Équipe B +1.5", "Total Équipe B +2.5"
    ]
};

// ====== INITIALISATION AU CHARGEMENT ======
document.addEventListener("DOMContentLoaded", () => {
    setupNavigation();
    setupFormAndFilters();
    setupTableToggle();
    renderApp();
});

// ====== GESTION DE LA NAVIGATION & PRÉ-REMPLISSAGE ======
function setupNavigation() {
    const links = document.querySelectorAll(".nav-link");
    links.forEach(link => {
        link.addEventListener("click", function(e) {
            e.preventDefault();
            links.forEach(l => l.classList.remove("active"));
            document.querySelectorAll(".content-section").forEach(s => s.classList.add("hidden"));
            
            this.classList.add("active");
            const targetId = this.getAttribute("href");
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                targetSection.classList.remove("hidden");
                
                if (targetId === "#add-bet") {
                    const datetimeInput = document.getElementById("bet-datetime");
                    if (datetimeInput) {
                        const now = new Date();
                        const tzOffset = now.getTimezoneOffset() * 60000;
                        const localISOTime = (new Date(now - tzOffset)).toISOString().slice(0, 16);
                        datetimeInput.value = localISOTime;
                    }
                }
            }
        });
    });

    const toggleSidebarBtn = document.getElementById("toggle-sidebar-btn");
    const sidebar = document.querySelector(".sidebar");
    const toggleIcon = document.getElementById("toggle-icon");

    if (toggleSidebarBtn && sidebar) {
        toggleSidebarBtn.addEventListener("click", (e) => {
            e.preventDefault();
            sidebar.classList.toggle("collapsed");

            if (sidebar.classList.contains("collapsed")) {
                if (toggleIcon) toggleIcon.className = "fa-solid fa-chevron-right";
                toggleSidebarBtn.setAttribute("title", "Ouvrir le menu");
            } else {
                if (toggleIcon) toggleIcon.className = "fa-solid fa-chevron-left";
                toggleSidebarBtn.setAttribute("title", "Réduire le menu");
            }

            if (capitalChartInstance !== null) {
                setTimeout(() => {
                    capitalChartInstance.resize();
                }, 220);
            }
        });
    }

    const themeBtn = document.getElementById("toggle-theme-btn");
    if (themeBtn) {
        themeBtn.addEventListener("click", () => {
            document.body.classList.toggle("light-theme");
        });
    }
}

// ====== GESTION DU REPLI DE L'HISTORIQUE ======
function setupTableToggle() {
    const tableContainer = document.querySelector(".table-container");
    const tableTitle = tableContainer ? tableContainer.querySelector("h3") || tableContainer.querySelector("h2") : null;
    
    if (tableTitle && tableContainer) {
        tableTitle.style.cursor = "pointer";
        tableTitle.innerHTML = `<i class="fa-solid fa-chevron-down toggle-table-icon" style="margin-right: 8px;"></i> ` + tableTitle.innerHTML;
        tableTitle.addEventListener("click", () => {
            tableContainer.classList.toggle("collapsed-table");
        });
    }
}

// ====== CONFIGURATION INTERACTIVE DU FORMULAIRE (Liaison des sélections) ======
function setupFormAndFilters() {
    const form = document.getElementById("bet-form");
    if (form) {
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            addNewBet();
        });
    }

    // MISE À JOUR DYNAMIQUE : Lie la Stratégie à la Sélection exacte (image_aef7e5.png)
    const strategySelect = document.getElementById("bet-strategy");
    const exactSelect = document.getElementById("bet-exact");

    if (strategySelect && exactSelect) {
        strategySelect.addEventListener("change", () => {
            const selectedStrat = strategySelect.value;
            const options = EXACT_SELECTIONS[selectedStrat] || [];
            
            exactSelect.innerHTML = "";
            options.forEach(opt => {
                const newOpt = document.createElement("option");
                newOpt.value = opt;
                newOpt.innerText = opt;
                exactSelect.appendChild(newOpt);
            });
        });
        
        // Déclenche l'événement une première fois pour initialiser le second menu
        strategySelect.dispatchEvent(new Event("change"));
    }

    const searchInput = document.getElementById("search-input");
    const filterStrat = document.getElementById("filter-strategy");
    const filterStatus = document.getElementById("filter-status");

    if (searchInput) searchInput.addEventListener("input", filterBets);
    if (filterStrat) filterStrat.addEventListener("change", filterBets);
    if (filterStatus) filterStatus.addEventListener("change", filterBets);
    
    if (filterStrat) {
        filterStrat.innerHTML = '<option value="">Toutes les Options</option>';
        AVAILABLE_STRATEGIES.forEach(strat => {
            filterStrat.innerHTML += `<option value="${strat}">${strat}</option>`;
        });
    }
}

// ====== CYCLE DE RENDU PRINCIPAL ======
function renderApp() {
    updateDashboard();
    renderBetsTable(appState.bets);
    buildCalendar();
    updateStrategiesComparison();
    
    if (typeof Chart !== 'undefined') {
        initCharts();
    }
}

// ====== OUTILS DE CALCULS ======
function calculateMetrics(betsList) {
    let profitTotal = 0;
    let gainsCount = 0;
    let lossesCount = 0;

    betsList.forEach(bet => {
        const odds = parseFloat(bet.odds);
        const stake = parseFloat(bet.stake);
        if (bet.outcome === "Gagné") {
            profitTotal += (stake * odds) - stake;
            gainsCount++;
        } else {
            profitTotal -= stake;
            lossesCount++;
        }
    });

    const currentCapital = appState.initialCapital + profitTotal;
    const roi = appState.bets.length > 0 ? (profitTotal / appState.initialCapital) * 100 : 0;
    const winrate = betsList.length > 0 ? (gainsCount / betsList.length) * 100 : 0;

    return { profitTotal, currentCapital, roi, winrate, gainsCount, lossesCount };
}

// ====== DASHBOARD ======
function updateDashboard() {
    const metrics = calculateMetrics(appState.bets);

    if (document.getElementById("stat-cap-actuel")) document.getElementById("stat-cap-actuel").innerText = metrics.currentCapital.toLocaleString() + " FCFA";
    if (document.getElementById("stat-profit-total")) document.getElementById("stat-profit-total").innerText = metrics.profitTotal.toLocaleString() + " FCFA";
    if (document.getElementById("stat-roi")) document.getElementById("stat-roi").innerText = metrics.roi.toFixed(2) + "%";
    if (document.getElementById("stat-winrate")) document.getElementById("stat-winrate").innerText = metrics.winrate.toFixed(1) + "%";
    if (document.getElementById("stat-bets-count")) document.getElementById("stat-bets-count").innerText = `${appState.bets.length} Paris (${metrics.gainsCount} G / ${metrics.lossesCount} P)`;

    const todayStr = new Date().toISOString().split('T')[0];
    const todayBets = appState.bets.filter(b => b.datetime && b.datetime.startsWith(todayStr));
    let todayProfit = 0;
    
    todayBets.forEach(b => {
        todayProfit += b.outcome === "Gagné" ? (b.stake * b.odds) - b.stake : -b.stake;
    });

    if (document.getElementById("stat-day-result")) document.getElementById("stat-day-result").innerText = `${todayProfit.toLocaleString()} / 10 000 FCFA`;
    
    const dayStatusEl = document.getElementById("day-status");
    const alertZone = document.getElementById("alert-zone");

    if (todayProfit >= appState.dailyGoal) {
        if (dayStatusEl) { dayStatusEl.innerText = "Objectif atteint !"; dayStatusEl.className = "stat-status green"; }
        if (alertZone) alertZone.classList.remove("hidden");
    } else {
        if (dayStatusEl) { dayStatusEl.innerText = "Non atteint"; dayStatusEl.className = "stat-status red"; }
        if (alertZone) alertZone.classList.add("hidden");
    }

    updateAdvancedInsights();
}

// ====== CORRECTIF SÉCURISÉ : ENREGISTRER UN PARI ======
function addNewBet() {
    // Lecture sécurisée des éléments existants du formulaire (évite tout plantage)
    const homeEl = document.getElementById("bet-home");
    const awayEl = document.getElementById("bet-away");
    const strategyEl = document.getElementById("bet-strategy");
    const exactEl = document.getElementById("bet-exact");
    const oddsEl = document.getElementById("bet-odds");
    const stakeEl = document.getElementById("bet-stake");
    const outcomeEl = document.getElementById("bet-outcome");
    const leagueEl = document.getElementById("bet-league");
    const datetimeEl = document.getElementById("bet-datetime");

    const newBet = {
        id: Date.now(),
        datetime: datetimeEl ? datetimeEl.value : new Date().toISOString().slice(0,16),
        league: leagueEl ? leagueEl.value : "Autre simulation",
        home: homeEl ? homeEl.value.trim() : "Inconnu",
        away: awayEl ? awayEl.value.trim() : "Inconnu",
        strategy: strategyEl ? strategyEl.value : "Général",
        exact: exactEl ? exactEl.value : "", // Sauvegarde de la sélection précise (V1, +2.5, etc.)
        odds: oddsEl ? parseFloat(oddsEl.value) : 1.00,
        stake: stakeEl ? parseFloat(stakeEl.value) : 0,
        outcome: outcomeEl ? outcomeEl.value : "Gagné"
    };

    appState.bets.unshift(newBet);
    localStorage.setItem('fifa_track_bets', JSON.stringify(appState.bets));
    
    const form = document.getElementById("bet-form");
    if (form) form.reset();
    
    renderApp();
    
    // Redirection fluide vers le Dashboard principal
    const dashboardLink = document.querySelector('.nav-link[href="#dashboard"]');
    if (dashboardLink) dashboardLink.click();
    
    alert("Pari enregistré avec succès !");
}

// ====== RENDU DU TABLEAU DE L'HISTORIQUE ======
function renderBetsTable(betsList) {
    const tbody = document.getElementById("bets-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    betsList.forEach(bet => {
        const netProfit = bet.outcome === "Gagné" ? (bet.stake * bet.odds) - bet.stake : -bet.stake;
        const tr = document.createElement("tr");

        // Utilise la sélection exacte s'il y en a une, sinon se rabat sur la stratégie globale
        const optionAffichee = bet.exact ? bet.exact : bet.strategy;

        tr.innerHTML = `
            <td>${bet.datetime ? bet.datetime.replace('T', ' ') : ''}</td>
            <td>${bet.league || ''}</td>
            <td><strong>${bet.home}</strong> vs <strong>${bet.away}</strong></td>
            <td><span class="badge-option" style="background: rgba(56, 189, 248, 0.1); color: #38bdf8; padding: 3px 8px; border-radius: 4px;">${optionAffichee}</span></td>
            <td>${bet.odds ? bet.odds.toFixed(2) : ''}</td>
            <td>${bet.stake ? bet.stake.toLocaleString() : ''}</td>
            <td style="color: ${netProfit >= 0 ? 'var(--success)' : 'var(--danger)'}; font-weight: bold;">
                ${netProfit >= 0 ? '+' : ''}${Math.round(netProfit).toLocaleString()} F
            </td>
            <td><span class="stat-status ${bet.outcome === 'Gagné' ? 'green' : 'red'}">${bet.outcome || ''}</span></td>
            <td>
                <button onclick="deleteBet(${bet.id})" style="background:none; border:none; color:var(--danger); cursor:pointer;">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ====== SUPPRESSION ======
window.deleteBet = function(id) {
    if (confirm("Supprimer ce pari définitivement ?")) {
        appState.bets = appState.bets.filter(b => b.id !== id);
        localStorage.setItem('fifa_track_bets', JSON.stringify(appState.bets));
        renderApp();
    }
};

// ====== RECHERCHE ET FILTRE ======
function filterBets() {
    const searchVal = document.getElementById("search-input") ? document.getElementById("search-input").value.toLowerCase() : "";
    const stratFilter = document.getElementById("filter-strategy") ? document.getElementById("filter-strategy").value : "";
    const statusFilter = document.getElementById("filter-status") ? document.getElementById("filter-status").value : "";

    let filtered = appState.bets.filter(bet => {
        const matchesSearch = (bet.league || "").toLowerCase().includes(searchVal) || 
                              (bet.home || "").toLowerCase().includes(searchVal) || 
                              (bet.away || "").toLowerCase().includes(searchVal);
        const matchesStrat = stratFilter ? bet.strategy === stratFilter : true;
        const matchesStatus = statusFilter ? bet.outcome === statusFilter : true;

        return matchesSearch && matchesStrat && matchesStatus;
    });

    renderBetsTable(filtered);
}

// ====== STRATÉGIES ET INSIGHTS ======
function updateStrategiesComparison() {
    const gridContainer = document.getElementById("strategies-container-grid");
    if (!gridContainer) return;
    gridContainer.innerHTML = "";

    let bestStratName = "Aucune donnée";
    let maxProfit = -Infinity;

    AVAILABLE_STRATEGIES.forEach(strat => {
        const stratBets = appState.bets.filter(b => b.strategy === strat);
        const metrics = calculateMetrics(stratBets);

        if (stratBets.length > 0 && metrics.profitTotal > maxProfit) {
            maxProfit = metrics.profitTotal;
            bestStratName = strat;
        }

        if (stratBets.length > 0) {
            const card = document.createElement("div");
            card.className = "strat-analysis-card";
            card.innerHTML = `
                <h3>${strat}</h3>
                <div style="margin-top: 10px; line-height: 1.6;">
                    Paris total : <strong>${stratBets.length}</strong><br>
                    Taux de réussite : <span style="color:var(--success)">${metrics.winrate.toFixed(1)}%</span><br>
                    Bénéfice net : <strong style="color: ${metrics.profitTotal >= 0 ? 'var(--success)' : 'var(--danger)'}">
                        ${metrics.profitTotal.toLocaleString()} FCFA
                    </strong>
                </div>
            `;
            gridContainer.appendChild(card);
        }
    });

    const bestEl = document.getElementById("best-strat-name");
    if (bestEl) bestEl.innerText = bestStratName;
}

function updateAdvancedInsights() {
    if (appState.bets.length === 0) return;

    let leaguesData = {};
    appState.bets.forEach(bet => {
        if (bet.league) {
            if (!leaguesData[bet.league]) leaguesData[bet.league] = 0;
            const profit = bet.outcome === "Gagné" ? (bet.stake * bet.odds) - bet.stake : -bet.stake;
            leaguesData[bet.league] += profit;
        }
    });

    let bestLeague = "-";
    let worstLeague = "-";
    let maxProfit = -Infinity;
    let minProfit = Infinity;

    for (let league in leaguesData) {
        if (leaguesData[league] > maxProfit) { maxProfit = leaguesData[league]; bestLeague = league; }
        if (leaguesData[league] < minProfit) { minProfit = leaguesData[league]; worstLeague = league; }
    }

    if (document.getElementById("best-league")) document.getElementById("best-league").innerText = bestLeague;
    if (document.getElementById("worst-league")) document.getElementById("worst-league").innerText = worstLeague;
    
    if (document.getElementById("avg-bets")) {
        const dates = [...new Set(appState.bets.map(b => b.datetime ? b.datetime.split('T')[0] : ""))].filter(d => d !== "");
        const avg = appState.bets.length / (dates.length || 1);
        document.getElementById("avg-bets").innerText = avg.toFixed(1) + " / jour";
    }
}

// ====== CALENDRIER INTERACTIF ======
function buildCalendar() {
    const grid = document.getElementById("calendar-grid");
    if (!grid) return;
    grid.innerHTML = "";

    const today = new Date();

    for (let i = 29; i >= 0; i--) {
        const currentDayDate = new Date();
        currentDayDate.setDate(today.getDate() - i);
        const dateStr = currentDayDate.toISOString().split('T')[0];
        const displayDate = currentDayDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });

        const dayBets = appState.bets.filter(b => b.datetime && b.datetime.startsWith(dateStr));
        
        let dayProfit = 0;
        let winCount = 0;

        dayBets.forEach(b => {
            if (b.outcome === "Gagné") {
                dayProfit += (b.stake * b.odds) - b.stake;
                winCount++;
            } else {
                dayProfit -= b.stake;
            }
        });

        const dayEl = document.createElement("div");
        dayEl.className = "calendar-day";
        
        if (dayBets.length > 0) {
            if (dayProfit >= 0) {
                dayEl.classList.add("day-win");
            } else {
                dayEl.classList.add("day-loss");
            }
        } else {
            dayEl.style.borderLeft = "3px solid var(--border)";
        }

        dayEl.innerHTML = `
            <strong>${displayDate}</strong><br>
            <small style="font-weight:bold; color:${dayBets.length > 0 ? (dayProfit >= 0 ? 'var(--success)' : 'var(--danger)') : 'var(--text-muted)'}">
                ${dayBets.length > 0 ? (dayProfit >= 0 ? '+' : '') + Math.round(dayProfit).toLocaleString() + ' F' : '0 F'}
            </small><br>
            <span style="font-size:0.7rem; color:var(--text-muted)">
                ${dayBets.length > 0 ? `🟢 ${dayBets.length} coupon(s)` : 'Aucun pari'}
            </span>
        `;

        dayEl.addEventListener("click", () => {
            if (dayBets.length === 0) {
                alert(`Le ${displayDate} :\nAucun match enregistré.`);
                return;
            }

            let detailMessage = `Résumé du ${displayDate} :\n`;
            detailMessage += `-------------------------\n`;
            detailMessage += `• Nombre de coupons joués : ${dayBets.length}\n`;
            detailMessage += `• Coupons gagnés : ${winCount}\n`;
            detailMessage += `• Coupons perdus : ${dayBets.length - winCount}\n`;
            detailMessage += `• Bilan financier : ${dayProfit >= 0 ? '+' : ''}${Math.round(dayProfit).toLocaleString()} FCFA\n\n`;
            detailMessage += `Détails des coupons :\n`;
            
            dayBets.forEach((b, idx) => {
                const optStr = b.exact ? b.exact : b.strategy;
                detailMessage += `${idx + 1}. ${b.home} vs ${b.away} (${b.league || 'FIFA'}) | Option : ${optStr} -> ${b.outcome}\n`;
            });

            alert(detailMessage);
        });

        grid.appendChild(dayEl);
    }
}

// ====== GRAPH EVOLUTION BANQUE ======
function initCharts() {
    const canvas = document.getElementById('capitalChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let current = appState.initialCapital;
    let dataPoints = [current];
    let labels = ["Départ"];

    const chronologicalBets = [...appState.bets].reverse();

    chronologicalBets.forEach((bet, index) => {
        current += bet.outcome === "Gagné" ? (bet.stake * bet.odds) - bet.stake : -bet.stake;
        dataPoints.push(current);
        labels.push(`P${index + 1}`);
    });

    if (capitalChartInstance) {
        capitalChartInstance.destroy();
    }

    capitalChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Solde Bankroll (FCFA)',
                data: dataPoints,
                borderColor: '#38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.05)',
                fill: true,
                tension: 0.15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#f8fafc' } }
            },
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(51, 65, 85, 0.05)' } },
                y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(51, 65, 85, 0.05)' } }
            }
        }
    });
}
