// ====== CONFIGURATION ET VARIABLES INITIALES ======
let appState = {
    initialCapital: 30000,
    dailyGoal: 10000,
    bets: JSON.parse(localStorage.getItem('fifa_track_bets')) || []
};

let capitalChartInstance = null;

// Liste complète de tes options pour le tracking analytique des performances
const AVAILABLE_STRATEGIES = [
    "Victoire", "Les 2 équipes marquent : Oui", "Les 2 équipes marquent : Non",
    "Total +1.5", "Total +2.5", "Total +3.5", "Total +4.5", "Total +5.5",
    "Total -1.5", "Total -2.5", "Total -3.5", "Total -4.5", "Total -5.5",
    "Total Équipe A +0.5", "Total Équipe A +1.5", "Total Équipe A +2.5", "Total Équipe A +3.5",
    "Total Équipe A -0.5", "Total Équipe A -1.5", "Total Équipe A -2.5", "Total Équipe A -3.5",
    "Total Équipe B +0.5", "Total Équipe B +1.5", "Total Équipe B +2.5", "Total Équipe B +3.5",
    "Total Équipe B -0.5", "Total Équipe B -1.5", "Total Équipe B -2.5", "Total Équipe B -3.5"
];

// ====== INITIALISATION AU CHARGEMENT ======
document.addEventListener("DOMContentLoaded", () => {
    setupNavigation();
    setupFormAndFilters();
    renderApp();
});

// ====== GESTION DE LA NAVIGATION & PRÉ-REMPLISSAGE DE L'HEURE ======
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
                
                // CORRECTIF HEURE : Remplit automatiquement la date et l'heure locale actuelle
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

    // CORRECTIF COMMANDE : Gestion de l'ouverture et fermeture de la Sidebar
    const toggleSidebarBtn = document.getElementById("toggle-sidebar-btn");
    const sidebar = document.querySelector(".sidebar");
    const toggleIcon = document.getElementById("toggle-icon");

    if (toggleSidebarBtn && sidebar) {
        toggleSidebarBtn.addEventListener("click", (e) => {
            e.preventDefault();
            sidebar.classList.toggle("collapsed");

            // Met à jour l'icône de la flèche selon l'état actuel
            if (sidebar.classList.contains("collapsed")) {
                if (toggleIcon) toggleIcon.className = "fa-solid fa-chevron-right";
                toggleSidebarBtn.setAttribute("title", "Ouvrir le menu");
            } else {
                if (toggleIcon) toggleIcon.className = "fa-solid fa-chevron-left";
                toggleSidebarBtn.setAttribute("title", "Réduire le menu");
            }

            // Force le redimensionnement instantané de ton graphique pour occuper l'espace libéré
            if (capitalChartInstance !== null) {
                setTimeout(() => {
                    capitalChartInstance.resize();
                }, 220); // Laisse le temps à la barre de finir l'animation CSS
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

// ====== LE FORMULAIRE ET FILTRES DE L'HISTORIQUE ======
function setupFormAndFilters() {
    const form = document.getElementById("bet-form");
    if (form) {
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            addNewBet();
        });
    }

    const searchInput = document.getElementById("search-input");
    const filterStrat = document.getElementById("filter-strategy");
    const filterStatus = document.getElementById("filter-status");

    if (searchInput) searchInput.addEventListener("input", filterBets);
    if (filterStrat) filterStrat.addEventListener("change", filterBets);
    if (filterStatus) filterStatus.addEventListener("change", filterBets);
    
    // Génère dynamiquement les options du filtre de recherche du tableau
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

// ====== OUTILS DE CALCULS DES MÉTRIQUES ======
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

// ====== MISE À JOUR DU DASHBOARD ======
function updateDashboard() {
    const metrics = calculateMetrics(appState.bets);

    document.getElementById("stat-cap-actuel").innerText = metrics.currentCapital.toLocaleString() + " FCFA";
    document.getElementById("stat-profit-total").innerText = metrics.profitTotal.toLocaleString() + " FCFA";
    document.getElementById("stat-roi").innerText = metrics.roi.toFixed(2) + "%";
    document.getElementById("stat-winrate").innerText = metrics.winrate.toFixed(1) + "%";
    document.getElementById("stat-bets-count").innerText = `${appState.bets.length} Paris (${metrics.gainsCount} G / ${metrics.lossesCount} P)`;

    // Gestion de l'objectif journalier (10 000 F)
    const todayStr = new Date().toISOString().split('T')[0];
    const todayBets = appState.bets.filter(b => b.datetime.startsWith(todayStr));
    let todayProfit = 0;
    
    todayBets.forEach(b => {
        todayProfit += b.outcome === "Gagné" ? (b.stake * b.odds) - b.stake : -b.stake;
    });

    document.getElementById("stat-day-result").innerText = `${todayProfit.toLocaleString()} / 10 000 FCFA`;
    
    const dayStatusEl = document.getElementById("day-status");
    const alertZone = document.getElementById("alert-zone");

    if (todayProfit >= appState.dailyGoal) {
        if (dayStatusEl) { dayStatusEl.innerText = "Objectif atteint !"; dayStatusEl.className = "stat-status green"; }
        if (alertZone) alertZone.classList.remove("hidden");
    } else {
        if (dayStatusEl) { dayStatusEl.innerText = "Non atteint"; dayStatusEl.className = "stat-status red"; }
        if (alertZone) alertZone.classList.add("hidden");
    }

    // Statistiques intelligentes (Championnats)
    updateAdvancedInsights();
}

// ====== AJOUTER UN NOUVEAU PARI ======
function addNewBet() {
    const newBet = {
        id: Date.now(),
        datetime: document.getElementById("bet-datetime").value,
        league: document.getElementById("bet-league").value,
        home: document.getElementById("bet-home").value.trim(),
        away: document.getElementById("bet-away").value.trim(),
        strategy: document.getElementById("bet-strategy").value, // Prend directement la méthode exacte
        odds: parseFloat(document.getElementById("bet-odds").value),
        stake: parseFloat(document.getElementById("bet-stake").value),
        outcome: document.getElementById("bet-outcome").value
    };

    appState.bets.unshift(newBet); // Ajout au début
    localStorage.setItem('fifa_track_bets', JSON.stringify(appState.bets));
    
    document.getElementById("bet-form").reset();
    renderApp();
    
    // Retour automatique au Dashboard principal après validation
    document.querySelector('.nav-link[href="#dashboard"]').click();
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

        tr.innerHTML = `
            <td>${bet.datetime.replace('T', ' ')}</td>
            <td>${bet.league}</td>
            <td><strong>${bet.home}</strong> vs <strong>${bet.away}</strong></td>
            <td><span class="badge-option">${bet.strategy}</span></td>
            <td>${bet.odds.toFixed(2)}</td>
            <td>${bet.stake.toLocaleString()}</td>
            <td style="color: ${netProfit >= 0 ? 'var(--success)' : 'var(--danger)'}; font-weight: bold;">
                ${netProfit >= 0 ? '+' : ''}${Math.round(netProfit).toLocaleString()} F
            </td>
            <td><span class="stat-status ${bet.outcome === 'Gagné' ? 'green' : 'red'}">${bet.outcome}</span></td>
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

// ====== FONCTION DE FILTRE DU TABLEAU ======
function filterBets() {
    const searchVal = document.getElementById("search-input").value.toLowerCase();
    const stratFilter = document.getElementById("filter-strategy").value;
    const statusFilter = document.getElementById("filter-status").value;

    let filtered = appState.bets.filter(bet => {
        const matchesSearch = bet.league.toLowerCase().includes(searchVal) || 
                              bet.home.toLowerCase().includes(searchVal) || 
                              bet.away.toLowerCase().includes(searchVal);
        const matchesStrat = stratFilter ? bet.strategy === stratFilter : true;
        const matchesStatus = statusFilter ? bet.outcome === statusFilter : true;

        return matchesSearch && matchesStrat && matchesStatus;
    });

    renderBetsTable(filtered);
}

// ====== ANALYSE ET COMPARAISON DES STRATÉGIES ======
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

        // On affiche uniquement les cartes des méthodes jouées pour éviter l'encombrement
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

// ====== ANALYSE AVANCÉE (MEILLEUR/PIRE CHAMPIONNAT) ======
function updateAdvancedInsights() {
    if (appState.bets.length === 0) return;

    let leaguesData = {};
    appState.bets.forEach(bet => {
        if (!leaguesData[bet.league]) {
            leaguesData[bet.league] = 0;
        }
        const profit = bet.outcome === "Gagné" ? (bet.stake * bet.odds) - bet.stake : -bet.stake;
        leaguesData[bet.league] += profit;
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
    
    // Calcul de la moyenne de paris par jour
    if (document.getElementById("avg-bets")) {
        const dates = [...new Set(appState.bets.map(b => b.datetime.split('T')[0]))];
        const avg = appState.bets.length / (dates.length || 1);
        document.getElementById("avg-bets").innerText = avg.toFixed(1) + " / jour";
    }
}

// ====== CALENDRIER 30 JOURS ======
function buildCalendar() {
    const grid = document.getElementById("calendar-grid");
    if (!grid) return;
    grid.innerHTML = "";

    for (let i = 1; i <= 30; i++) {
        const dayEl = document.createElement("div");
        dayEl.className = "calendar-day";
        dayEl.style.borderLeft = "3px solid var(--border)";
        dayEl.innerHTML = `<strong>J${i}</strong><br><small>0 F</small>`;
        grid.appendChild(dayEl);
    }
}

// ====== GRAPHIQUE CHART.JS ======
function initCharts() {
    const canvas = document.getElementById('capitalChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let current = appState.initialCapital;
    let dataPoints = [current];
    let labels = ["Départ"];

    // Inverser la copie pour afficher l'évolution chronologique (du plus ancien au plus récent)
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
