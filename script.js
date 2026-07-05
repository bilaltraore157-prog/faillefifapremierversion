// ====== CONFIGURATION ET VARIABLES INITIALES ======
let appState = {
    initialCapital: 30000,
    dailyGoal: 10000,
    bets: JSON.parse(localStorage.getItem('fifa_track_bets')) || []
};

let capitalChartInstance = null;

const AVAILABLE_STRATEGIES = [
    "Victoire Domicile (V1)", "Victoire Extérieur (V2)", "Match Nul (X)",
    "Double chance (1x)", "Double chance (x2)",
    "Total +1.5", "Total +2.5", "Total +3.5", "Total +4.5", "Total +5.5",
    "Total -1.5", "Total -2.5", "Total -3.5", "Total -4.5", "Total -5.5",
    "Les 2 marquent : Oui", "Les 2 marquent : Non",
    "Équipe Domicile Total +0.5", "Équipe Domicile Total +1.5", "Équipe Domicile Total +2.5", "Équipe Domicile Total +3.5",
    "Équipe Domicile Total -0.5", "Équipe Domicile Total -1.5", "Équipe Domicile Total -2.5", "Équipe Domicile Total -3.5",
    "Équipe Extérieur Total +0.5", "Équipe Extérieur Total +1.5", "Équipe Extérieur Total +2.5", "Équipe Extérieur Total +3.5",
    "Équipe Extérieur Total -0.5", "Équipe Extérieur Total -1.5", "Équipe Extérieur Total -2.5", "Équipe Extérieur Total -3.5"
];

// ====== INITIALISATION ======
document.addEventListener("DOMContentLoaded", () => {
    setupNavigation();
    setupFormAndFilters();
    renderApp();
});

function setupNavigation() {
    const links = document.querySelectorAll(".nav-link");
    const sidebar = document.querySelector(".sidebar");
    const toggleIcon = document.getElementById("toggle-icon");

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

            // CORRECTION MOBILE : Ferme automatiquement le menu après avoir cliqué sur un lien
            if (window.innerWidth <= 768 && sidebar.classList.contains("open")) {
                sidebar.classList.remove("open");
                if (toggleIcon) toggleIcon.className = "fa-solid fa-bars";
            }
        });
    });

    const toggleSidebarBtn = document.getElementById("toggle-sidebar-btn");
    if (toggleSidebarBtn && sidebar) {
        toggleSidebarBtn.addEventListener("click", (e) => {
            e.preventDefault();
            
            if (window.innerWidth <= 768) {
                sidebar.classList.toggle("open");
                if (sidebar.classList.contains("open")) {
                    if (toggleIcon) toggleIcon.className = "fa-solid fa-xmark"; // Un 'X' pour fermer
                } else {
                    if (toggleIcon) toggleIcon.className = "fa-solid fa-bars";  // Les 3 barres pour ouvrir
                }
            } else {
                sidebar.classList.toggle("collapsed");
                if (sidebar.classList.contains("collapsed")) {
                    if (toggleIcon) toggleIcon.className = "fa-solid fa-chevron-right";
                } else {
                    if (toggleIcon) toggleIcon.className = "fa-solid fa-chevron-left";
                }
            }

            if (capitalChartInstance !== null) {
                setTimeout(() => { capitalChartInstance.resize(); }, 220);
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


function setupFormAndFilters() {
    const form = document.getElementById("bet-form");
    if (form) {
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            addNewBet();
        });
    }

    const strategySelect = document.getElementById("bet-strategy");
    if (strategySelect) {
        strategySelect.innerHTML = '<option value="" disabled selected>Choisir la méthode précise</option>';
        AVAILABLE_STRATEGIES.forEach(strat => {
            const opt = document.createElement("option");
            opt.value = strat; opt.innerText = strat;
            strategySelect.appendChild(opt);
        });
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

function renderApp() {
    updateDashboard();
    renderBetsTable(appState.bets);
    buildCalendar();
    updateStrategiesComparison();
    if (typeof Chart !== 'undefined') { initCharts(); }
}

function calculateMetrics(betsList) {
    let profitTotal = 0; let gainsCount = 0; let lossesCount = 0;

    betsList.forEach(bet => {
        const odds = parseFloat(bet.odds) || 0;
        const stake = parseFloat(bet.stake) || 0;
        if (bet.outcome === "Gagné") {
            profitTotal += (stake * odds) - stake; gainsCount++;
        } else {
            profitTotal -= stake; lossesCount++;
        }
    });

    const currentCapital = appState.initialCapital + profitTotal;
    const roi = appState.bets.length > 0 ? (profitTotal / appState.initialCapital) * 100 : 0;
    const winrate = betsList.length > 0 ? (gainsCount / betsList.length) * 100 : 0;

    return { profitTotal, currentCapital, roi, winrate, gainsCount, lossesCount };
}

function updateDashboard() {
    const metrics = calculateMetrics(appState.bets);

    // Sélection des éléments textuels
    const capEl = document.getElementById("stat-cap-actuel");
    const profitEl = document.getElementById("stat-profit-total");
    const roiEl = document.getElementById("stat-roi");
    const winrateEl = document.getElementById("stat-winrate");
    const countEl = document.getElementById("stat-bets-count");
    const dayResultEl = document.getElementById("stat-day-result");

    // Injection des valeurs
    if (capEl) capEl.innerText = metrics.currentCapital.toLocaleString() + " FCFA";
    if (countEl) countEl.innerText = `${appState.bets.length} Paris (${metrics.gainsCount} G / ${metrics.lossesCount} P)`;
    if (winrateEl) winrateEl.innerText = metrics.winrate.toFixed(1) + "%";

    // 1. Coloration dynamique du Profit Global
    if (profitEl) {
        profitEl.innerText = (metrics.profitTotal >= 0 ? "+" : "") + metrics.profitTotal.toLocaleString() + " FCFA";
        profitEl.className = metrics.profitTotal >= 0 ? "text-green" : "text-red";
    }

    // 2. Coloration dynamique du ROI
    if (roiEl) {
        roiEl.innerText = (metrics.roi >= 0 ? "+" : "") + metrics.roi.toFixed(2) + "%";
        roiEl.className = metrics.roi >= 0 ? "text-green" : "text-red";
    }

    // Calcul du profit de la journée en cours
    const todayStr = new Date().toISOString().split('T')[0];
    const todayBets = appState.bets.filter(b => b.datetime && b.datetime.startsWith(todayStr));
    let todayProfit = 0;
    
    todayBets.forEach(b => {
        const odds = parseFloat(b.odds) || 0;
        const stake = parseFloat(b.stake) || 0;
        todayProfit += b.outcome === "Gagné" ? (stake * odds) - stake : -stake;
    });

    // 3. Coloration dynamique du résultat de l'objectif journalier
    if (dayResultEl) {
        dayResultEl.innerText = `${todayProfit.toLocaleString()} / 10 000 FCFA`;
        dayResultEl.className = todayProfit >= 0 ? "text-green" : "text-red";
    }
    
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

function addNewBet() {
    const homeEl = document.getElementById("bet-home");
    const awayEl = document.getElementById("bet-away");
    const strategyEl = document.getElementById("bet-strategy");
    const oddsEl = document.getElementById("bet-odds");
    const stakeEl = document.getElementById("bet-stake");
    const outcomeEl = document.getElementById("bet-outcome");
    const leagueEl = document.getElementById("bet-league");
    const datetimeEl = document.getElementById("bet-datetime");

    const newBet = {
        id: Date.now(),
        datetime: datetimeEl ? datetimeEl.value : new Date().toISOString().slice(0,16),
        league: leagueEl && leagueEl.value ? leagueEl.value : "Autre simulation",
        home: homeEl && homeEl.value ? homeEl.value.trim() : "Inconnu",
        away: awayEl && awayEl.value ? awayEl.value.trim() : "Inconnu",
        strategy: strategyEl ? strategyEl.value : "Général",
        odds: oddsEl ? parseFloat(oddsEl.value) : 1.00,
        stake: stakeEl ? parseFloat(stakeEl.value) : 0,
        outcome: outcomeEl ? outcomeEl.value : "Gagné"
    };

    appState.bets.unshift(newBet);
    localStorage.setItem('fifa_track_bets', JSON.stringify(appState.bets));
    
const form = document.getElementById("bet-form");
    if (form) form.reset();
    
    if (strategyEl) strategyEl.value = "";
    renderApp();
    
    const dashboardLink = document.querySelector('.nav-link[href="#dashboard"]');
    if (dashboardLink) dashboardLink.click();
    alert("Pari enregistré avec succès !");
}

function renderBetsTable(betsList) {
    const tbody = document.getElementById("bets-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    betsList.forEach(bet => {
        const odds = parseFloat(bet.odds) || 0;
        const stake = parseFloat(bet.stake) || 0;
        const netProfit = bet.outcome === "Gagné" ? (stake * odds) - stake : -stake;
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${bet.datetime ? bet.datetime.replace('T', ' ') : ''}</td>
            <td>${bet.league || ''}</td>
            <td><strong>${bet.home}</strong> vs <strong>${bet.away}</strong></td>
            <td><span class="badge-option" style="background: rgba(56, 189, 248, 0.1); color: #38bdf8; padding: 3px 8px; border-radius: 4px;">${bet.strategy}</span></td>
            <td>${odds.toFixed(2)}</td>
            <td>${stake.toLocaleString()}</td>
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

window.deleteBet = function(id) {
    if (confirm("Supprimer ce pari définitivement ?")) {
        appState.bets = appState.bets.filter(b => b.id !== id);
        localStorage.setItem('fifa_track_bets', JSON.stringify(appState.bets));
        renderApp();
    }
};

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

function updateStrategiesComparison() {
    const gridContainer = document.getElementById("strategies-container-grid");
    if (!gridContainer) return;
    gridContainer.innerHTML = "";

    let bestStratName = "Aucune donnée"; let maxProfit = -Infinity;

    AVAILABLE_STRATEGIES.forEach(strat => {
        const stratBets = appState.bets.filter(b => b.strategy === strat);
        const metrics = calculateMetrics(stratBets);

        if (stratBets.length > 0 && metrics.profitTotal > maxProfit) {
            maxProfit = metrics.profitTotal; bestStratName = strat;
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
    if (appState.bets.length === 0) {
        if (document.getElementById("best-league")) document.getElementById("best-league").innerText = "-";
        if (document.getElementById("worst-league")) document.getElementById("worst-league").innerText = "-";
        return;
    }

    let leaguesData = {};
    appState.bets.forEach(bet => {
        if (bet.league) {
            if (!leaguesData[bet.league]) leaguesData[bet.league] = 0;
            const odds = parseFloat(bet.odds) || 0;
            const stake = parseFloat(bet.stake) || 0;
            const profit = bet.outcome === "Gagné" ? (odds * stake) - stake : -stake;
            leaguesData[bet.league] += profit;
        }
    });

    let bestLeague = "-"; let worstLeague = "-"; let maxProfit = -Infinity; let minProfit = Infinity; let hasData = false;

    for (let league in leaguesData) {
        hasData = true;
        if (leaguesData[league] > maxProfit) { maxProfit = leaguesData[league]; bestLeague = league; }
        if (leaguesData[league] < minProfit) { minProfit = leaguesData[league]; worstLeague = league; }
    }

    if (document.getElementById("best-league")) document.getElementById("best-league").innerText = hasData ? bestLeague : "-";
    if (document.getElementById("worst-league")) document.getElementById("worst-league").innerText = hasData ? worstLeague : "-";
    
    if (document.getElementById("avg-bets")) {
        const dates = [...new Set(appState.bets.map(b => b.datetime ? b.datetime.split('T')[0] : ""))].filter(d => d !== "");
        const avg = appState.bets.length / (dates.length || 1);
        document.getElementById("avg-bets").innerText = avg.toFixed(1) + " / jour";
    }
}

function buildCalendar() {
    const grid = document.getElementById("calendar-grid");
    if (!grid) return;
    grid.innerHTML = ""; 

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // Mois actuel (0 = Janvier, 6 = Juillet, etc.)

    // Trouver le nombre total de jours dans ce mois (ex: 31 pour Juillet)
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Boucle du 1er jour jusqu'au dernier jour du mois
    for (let day = 1; day <= totalDaysInMonth; day++) {
        // Créer la date exacte pour ce jour précis
        const currentDate = new Date(currentYear, currentMonth, day);
        
        // Formater en YYYY-MM-DD pour filtrer les paris
        const yyyy = currentDate.getFullYear();
        const mm = String(currentMonth + 1).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const displayDate = `${dd}/${mm}/${yyyy}`;
        // Filtrer les paris de cette journée
        const dayBets = appState.bets.filter(b => b.datetime && b.datetime.startsWith(dateStr));

        // Calculer le profit ou la perte du jour
        let dayProfit = 0;
        dayBets.forEach(b => {
            const odds = parseFloat(b.odds) || 0;
            const stake = parseFloat(b.stake) || 0;
            if (b.outcome === "Gagné") {
                dayProfit += (stake * odds) - stake;
            } else {
                dayProfit -= stake;
            }
        });

        // Configurer les classes et le texte du bilan
        let profitText = "0 F";
        let statusClass = "neutral";
        let cardBorderClass = "";

        if (dayBets.length > 0) {
            if (dayProfit > 0) {
                profitText = `+${dayProfit.toLocaleString()} F`;
                statusClass = "text-green";
                cardBorderClass = "border-green";
            } else if (dayProfit < 0) {
                profitText = `${dayProfit.toLocaleString()} F`;
                statusClass = "text-red";
                cardBorderClass = "border-red";
            }
        }

        const couponText = dayBets.length > 0 ? `${dayBets.length} coupon(s)` : "Aucun pari";
        const indicatorDot = dayBets.length > 0 ? `<span class="dot-indicator"></span>` : "";

        // Créer l'élément HTML pour le jour
        const dayEl = document.createElement("div");
        // On garde "calendar-day" si c'est ta classe d'origine, en ajoutant la bordure dynamique
        dayEl.className = `calendar-day ${cardBorderClass}`; 
        
        dayEl.innerHTML = `
            <div class="day-date">${displayDate}</div>
            <div class="day-profit ${statusClass}">${profitText}</div>
            <div class="day-coupons">
                ${indicatorDot}${couponText}
            </div>
        `;
         // Rendre la case cliquable pour ouvrir le bilan
        dayEl.style.cursor = "pointer";
        dayEl.addEventListener("click", () => openDailyModal(displayDate, dayProfit, dayBets));  
        grid.appendChild(dayEl);
    }
}

function initCharts() {
    const canvas = document.getElementById('capitalChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let current = appState.initialCapital;
    let dataPoints = [current]; let labels = ["Départ"];
    const chronologicalBets = [...appState.bets].reverse();

    chronologicalBets.forEach((bet, index) => {
        const odds = parseFloat(bet.odds) || 0;
        const stake = parseFloat(bet.stake) || 0;
        current += bet.outcome === "Gagné" ? (stake * odds) - stake : -stake;
        dataPoints.push(current); labels.push(`P${index + 1}`);
    });

    if (capitalChartInstance) { capitalChartInstance.destroy(); }

    capitalChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Solde Bankroll (FCFA)',
                data: dataPoints,
                borderColor: '#38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.05)',
                fill: true, tension: 0.15
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#f8fafc' } } },
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(51, 65, 85, 0.05)' } },
                y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(51, 65, 85, 0.05)' } }
            }
        }
    });
}

// 1. Base de données des équipes par championnat (Extraite de tes images)
const teamsByLeague = {
    "Angleterre": [
        "Tottenham Hotspur", "Arsenal", "Manchester City", "Chelsea", "Liverpool", 
        "Manchester United", "Aston Villa", "West Ham United", "Newcastle United", 
        "Bournemouth", "Southampton", "Everton", "Wolverhampton Wanderers", 
        "Crystal Palace", "Ipswich Town", "Brentford", "Leicester City", "Fulham", 
        "Nottingham Forest", "Brighton et Hove Albion"
    ],
    "Allemagne": [
        "Leipzig", "Borussia", "Bayer 04", "VfL Wolfsburg", "Bayern Munich", 
        "Borussia Monchengladbach", "FSV Mainz 05 .1", "TSG 1899 Hoffenheim", 
        "Eintracht", "Werder Bremen", "Heidenheim 1846 .1", "VfB Stuttgart", 
        "Union Berlin", "Freiburg", "Augsburg", "VfL Bochum", "St. Pauli", "Holstein"
    ],
    "Espagne": [
        "Barcelone", "Real Madrid", "Villarreal", "Valencia", "Athletic Bilbao", 
        "Celta", "Club Atlético de Madrid", "Real Oviedo", "Gérone", "Majorque", 
        "Elche", "Real Sociedad", "Getafe", "Séville", "Real Betis", "Osasuna", 
        "Espanyol", "Rayo Vallecano", "Levante UD", "Deportivo Alaves"
    ],
    "Italie": [
        "Milano", "Lombardia", "Latium", "Napoli", "Roma", "Torino", "Bergamo Calcio", 
        "Venise", "Fiorentine", "Como", "Monza", "Bologna 1909", "Juventus", 
        "Cagliari Calcio", "Parma", "Genoa", "Lecce", "Udinese Calcio", "Hellas Verona", "Empoli"
    ]
};

// 2. Fonction pour mettre à jour les listes déroulantes des équipes
function updateTeamSelectors() {
    const leagueSelect = document.getElementById("bet-league");
    const homeSelect = document.getElementById("bet-home");
    const awaySelect = document.getElementById("bet-away");

    if (!leagueSelect || !homeSelect || !awaySelect) return;

    // Écouter le changement de championnat
    leagueSelect.addEventListener("change", function() {
        const selectedLeague = this.value;
        
        // Vider les anciennes options
        homeSelect.innerHTML = '<option value="" disabled selected>Choisir l\'équipe domicile</option>';
        awaySelect.innerHTML = '<option value="" disabled selected>Choisir l\'équipe extérieur</option>';

        if (teamsByLeague[selectedLeague]) {
            // Ajouter les équipes correspondantes
            teamsByLeague[selectedLeague].forEach(team => {
                const option1 = document.createElement("option");
                option1.value = team;
                option1.textContent = team;
                
                const option2 = document.createElement("option");
                option2.value = team;
                option2.textContent = team;

                homeSelect.appendChild(option1);
                awaySelect.appendChild(option2);
            });
        } else {
            // Si une autre option ou un palier personnalisé est sélectionné
            homeSelect.innerHTML = '<option value="Autre Dom">Autre équipe Domicile</option>';
            awaySelect.innerHTML = '<option value="Autre Ext">Autre équipe Extérieur</option>';
        }
    });
}

// 3. Initialisation au chargement du script
updateTeamSelectors();

// Fonction pour ouvrir la pop-up avec les détails du jour
function openDailyModal(displayDate, dayProfit, dailyBets) {
    const modal = document.getElementById("daily-modal");
    document.getElementById("modal-date").textContent = `Bilan du ${displayDate}`;
    
    const profitEl = document.getElementById("modal-profit");
    const couponsEl = document.getElementById("modal-coupons");
    const listEl = document.getElementById("modal-bets-list");
    
    listEl.innerHTML = ""; // Vider l'ancienne liste
    
    profitEl.textContent = dayProfit >= 0 ? `+${dayProfit} F` : `${dayProfit} F`;
    profitEl.style.color = dayProfit >= 0 ? "#34d399" : "#f87171";
    couponsEl.textContent = `${dailyBets.length} coupon(s)`;
    
    if (!dailyBets || dailyBets.length === 0) {
        listEl.innerHTML = '<p style="color:#94a3b8; font-size:0.9rem;">Journée calme. Aucun pari enregistré !</p>';
    } else {
        dailyBets.forEach(bet => {
            const item = document.createElement("div");
            
            // 1. Détection du résultat
            const estGagne = bet.outcome === "Gagné" || bet.status === "Gagné" || bet.resultat === "Gagné";
            item.className = `modal-bet-item ${estGagne ? 'win' : 'loss'}`;
            
            // 2. DETECTION MAXIMALE DU NOM DU MATCH
            // On teste toutes les clés imaginables pour récupérer "Real Madrid vs Athletic Bilbao"
            let nomMatch = bet.match || bet.teams || bet.teamsText || bet.fixture || bet.description || bet.affiche;
            
            // Si c'est toujours vide, on tente de combiner les variables d'équipes séparées
            if (!nomMatch) {
                const dom = bet.homeTeam || bet.home || bet.team1 || bet.equipe1 || bet.equipeDom || bet.home_team;
                const ext = bet.awayTeam || bet.away || bet.team2 || bet.equipe2 || bet.equipeExt || bet.away_team;
                if (dom || ext) {
                    nomMatch = `${dom || 'Équipe'} vs ${ext || 'Équipe'}`;
                }
            }
            
            // Si c'est toujours introuvable, on va fouiller dans les clés de l'objet pour trouver un texte qui contient "vs"
            if (!nomMatch) {
                const cles = Object.keys(bet);
                for (let cle of cles) {
                    if (typeof bet[cle] === 'string' && bet[cle].toLowerCase().includes('vs')) {
                        nomMatch = bet[cle];
                        break;
                    }
                }
            }
            
            // Sécurité finale
            if (!nomMatch) {
                nomMatch = "Match de Football";
            }
            
            // 3. Infos secondaires
            const championnt = bet.league || bet.championnat || "FIFA";
            const cotePari = bet.odds || bet.cote || "1.00";
            
            // 4. Récupération du bénéfice net (Déjà OK !)
            let montantAffiche = 0;
            if (estGagne) {
                montantAffiche = bet.netProfit || bet.profitNet || bet.benefice || bet.beneficeNet || bet.gain || bet.profit || 0;
                if (montantAffiche === 0) {
                    const mise = parseFloat(bet.stake || bet.mise || 0);
                    const cote = parseFloat(cotePari);
                    if (mise > 0 && cote > 1) {
                        montantAffiche = (mise * cote) - mise;
                    }
                }
            } else {
                const mise = parseFloat(bet.stake || bet.mise || 0);
                montantAffiche = bet.profit || bet.benefice || -mise;
            }
            
            const signe = montantAffiche > 0 ? '+' : '';
            
            item.innerHTML = `
                <div style="text-align: left; flex: 1;">
                    <div class="modal-bet-teams" style="color: #f8fafc; font-weight: 600;">${nomMatch}</div>
                    <div class="modal-bet-info" style="color: #94a3b8; font-size: 0.8rem;">${championnt} • Cote: ${cotePari}</div>
                </div>
                <div class="modal-bet-result" style="font-weight: bold; color: ${estGagne ? '#34d399' : '#f87171'}">
                    ${signe}${Math.round(montantAffiche)} F
                </div>
            `;
            listEl.appendChild(item);
        });
    }
    
    modal.style.display = "flex";
}

// Fonction pour fermer la pop-up
function closeDailyModal() {
    document.getElementById("daily-modal").style.display = "none";
}

// Fermer aussi la pop-up si on clique en dehors de la boîte
window.addEventListener("click", (e) => {
    const modal = document.getElementById("daily-modal");
    if (e.target === modal) {
        closeDailyModal();
    }
});