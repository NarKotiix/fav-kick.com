// ==UserScript==
// @name         Onglet Favoris Emojis pour Kick.com
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Ajoute un onglet Favoris pour les emojis sur Kick avec gestion via CTRL+clic gauche
// @author       ChatGPT
// @match        https://kick.com/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/NarKotiix/fav-kick.com/refs/heads/main/fav-kick.com.user.js
// @downloadURL  https://raw.githubusercontent.com/NarKotiix/fav-kick.com/refs/heads/main/fav-kick.com.user.js
// ==/UserScript==

(function() {
    'use strict';

    // Utilitaires favoris (par URL d'image)
    const FAVORIS_KEY = 'emotes_favoris_kick';
    function getFavoris() {
        return JSON.parse(localStorage.getItem(FAVORIS_KEY) || '[]');
    }
    function setFavoris(arr) {
        localStorage.setItem(FAVORIS_KEY, JSON.stringify(arr));
    }
    function toggleFavori(emote) {
        let favs = getFavoris();
        const idx = favs.findIndex(e => e.src === emote.src);
        if (idx === -1) favs.push(emote);
        else favs.splice(idx, 1);
        setFavoris(favs);
    }
    function isFavori(src) {
        return getFavoris().some(e => e.src === src);
    }

    // Fonction utilitaire pour insérer une émote dans le chat Kick
    function insertEmoteInChat(emoteAlt) {
        const editor = document.querySelector('#chat-input-wrapper [contenteditable="true"].editor-input');
        if (editor) {
            const toInsert = emoteAlt ? emoteAlt : '';
            editor.focus();
            document.execCommand('insertText', false, toInsert);
        }
    }

    // Ajoute ou retire l'étoile sur un bouton d'émote
    function updateStarOnButton(btn, isFav) {
        let star = btn.querySelector('.fav-star');
        if (isFav) {
            if (!star) {
                star = document.createElement('span');
                star.className = 'fav-star';
                star.textContent = '★';
                star.style.position = 'absolute';
                star.style.top = '22px';
                star.style.right = '-7px';
                star.style.color = 'gold';
                star.style.fontSize = '1.1em';
                star.style.pointerEvents = 'none';
                btn.appendChild(star);
            }
        } else {
            if (star) star.remove();
        }
    }

    // Attendre que la barre d'onglets soit présente (desktop OU mobile)
    function waitForTabsBar(cb) {
        const interval = setInterval(() => {
            // Desktop
            let tabBar = document.querySelector('button[data-active]')?.parentElement;
            // Mobile : parfois la barre d'onglets est plus profonde
            if (!tabBar) {
                const btn = document.querySelector('button[data-active]');
                if (btn) tabBar = btn.closest('div.flex') || btn.parentElement;
            }
            if (tabBar) {
                clearInterval(interval);
                cb(tabBar);
            }
        }, 500);
    }

    // Injection et réinjection automatique du bouton Favoris sur chaque apparition de la barre d'onglets
    function autoInjectFavorisTab() {
        let lastTabBar = null;
        let favorisBtn = null;

        function inject() {
            waitForTabsBar(tabBar => {
                if (lastTabBar !== tabBar) {
                    lastTabBar = tabBar;
                    favorisBtn = createFavorisButton();
                    tabBar.insertBefore(favorisBtn, tabBar.firstChild);
                    setupFavorisTab(tabBar, favorisBtn);
                    setupKickTabs(tabBar, favorisBtn);
                } else if (!tabBar.contains(favorisBtn)) {
                    tabBar.insertBefore(favorisBtn, tabBar.firstChild);
                }
            });
        }

        // Observe les changements du DOM pour détecter la (ré)apparition de la barre d'onglets
        const observer = new MutationObserver(() => {
            inject();
        });

        // Surveille tout le document (peu coûteux car la barre d'onglets est peu modifiée)
        observer.observe(document.body, { childList: true, subtree: true });

        // Injection initiale
        inject();
    }

    // Créer le bouton Favoris
    function createFavorisButton() {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'group flex size-11 shrink-0 grow-0 flex-col items-center gap-2 lg:size-10 [&_img]:size-7 [&_img]:rounded-full [&_img]:lg:size-6 [&_svg]:size-7 [&_svg]:rounded-full [&_svg]:lg:size-6';
        btn.innerHTML = `
            <svg width="32" height="32" viewBox="0 0 32 32" fill="white" xmlns="http://www.w3.org/2000/svg">
                <text x="8" y="24" font-size="20" fill="currentColor">★</text>
            </svg>
            <div class="betterhover:group-hover:bg-[#475054] z-common h-0.5 w-full transition-colors duration-300"></div>
        `;
        btn.title = 'Favoris';
        btn.dataset.favoris = "true";
        return btn;
    }

    // Sauvegarder/restaurer le contenu original du panel
    let originalPanelHTML = null;
    function saveOriginalPanel() {
        const emojiPanel = getEmojiPanel();
        if (emojiPanel && originalPanelHTML === null) {
            originalPanelHTML = emojiPanel.innerHTML;
            // Ajout des étoiles sur les favoris
            emojiPanel.querySelectorAll('button > img.aspect-square').forEach(img => {
                const btn = img.parentElement;
                updateStarOnButton(btn, isFavori(img.src));
            });
        }
    }
    function restoreOriginalPanel() {
        const emojiPanel = getEmojiPanel();
        if (emojiPanel && originalPanelHTML !== null) {
            emojiPanel.innerHTML = originalPanelHTML;
            // Ajout des étoiles sur les favoris
            emojiPanel.querySelectorAll('button > img.aspect-square').forEach(img => {
                const btn = img.parentElement;
                updateStarOnButton(btn, isFavori(img.src));
            });
        }
    }

    // Trouver le panel d'émotes Kick (desktop OU mobile)
    function getEmojiPanel() {
        // Desktop
        let panel = document.querySelector('.pl-5.pr-2\\.5 > .h-60.overflow-y-auto.py-2.pr-2\\.5 > .grid.gap-2');
        if (panel) return panel;
        // Mobile / réduit
        panel = document.querySelector('.overflow-y-auto.py-2.pr-2 > .grid.gap-2');
        if (panel) return panel;
        // Fallback : retourne null si rien trouvé
        return null;
    }

    // Afficher les favoris dans le panel
    function showFavorisTab() {
        const emojiPanel = getEmojiPanel();
        if (!emojiPanel) return;
        emojiPanel.innerHTML = '';
        const favs = getFavoris();
        if (favs.length === 0) {
            emojiPanel.textContent = "Aucun favori. CTRL+clic sur une émote pour l'ajouter.";
            return;
        }
        // On crée une grille similaire à Kick
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-8 justify-between gap-2';
        favs.forEach(emote => {
            const btn = document.createElement('button');
            btn.className = 'betterhover:hover:bg-white/10 disabled:betterhover:hover:bg-white/10 relative aspect-square size-10 rounded-sm p-1 disabled:opacity-40 lg:size-9';
            btn.dataset.state = "closed";
            btn.style.position = "relative";
            const img = document.createElement('img');
            img.className = 'aspect-square size-8 lg:size-7';
            img.src = emote.src;
            img.alt = emote.alt || '';
            img.loading = 'lazy';
            btn.appendChild(img);
            // Ajout de l'étoile
            updateStarOnButton(btn, true);
            // CTRL+clic pour retirer des favoris
            btn.addEventListener('click', (e) => {
                if (e.ctrlKey) {
                    toggleFavori(emote);
                    showFavorisTab();
                    e.preventDefault();
                    e.stopPropagation();
                } else {
                    insertEmoteInChat(emote.alt);
                    e.preventDefault();
                    e.stopPropagation();
                }
            });
            grid.appendChild(btn);
        });
        emojiPanel.appendChild(grid);
    }

    // Gérer le clic sur le bouton Favoris
    function setupFavorisTab(tabBar, favorisBtn) {
        favorisBtn.addEventListener('click', () => {
            // Désactiver tous les autres onglets
            tabBar.querySelectorAll('button').forEach(btn => btn.dataset.active = "false");
            favorisBtn.dataset.active = "true";
            saveOriginalPanel();
            showFavorisTab();
        });
    }

    // Gérer le clic sur les onglets Kick pour restaurer le panel d'origine
    function setupKickTabs(tabBar, favorisBtn) {
        tabBar.querySelectorAll('button:not([data-favoris])').forEach(btn => {
            btn.addEventListener('click', () => {
                favorisBtn.dataset.active = "false";
                restoreOriginalPanel();
            });
        });
    }

    // Gérer CTRL+clic sur les émotes Kick pour ajouter/retirer des favoris
    function setupEmoteClick() {
        document.body.addEventListener('click', function(e) {
            // On cible les boutons d'émotes Kick (hors favoris)
            const img = e.target.closest('button > img.aspect-square');
            if (img) {
                const btn = img.parentElement;
                const emote = { src: img.src, alt: img.alt };
                if (e.ctrlKey) {
                    toggleFavori(emote);
                    // Ajout/retrait de l'étoile
                    updateStarOnButton(btn, isFavori(img.src));
                    // Si on est dans l'onglet favoris, on met à jour l'affichage
                    const favorisTabActive = document.querySelector('button[data-favoris="true"][data-active="true"]');
                    if (favorisTabActive) {
                        showFavorisTab();
                    }
                    e.preventDefault();
                    e.stopPropagation();
                } else {
                    insertEmoteInChat(emote.alt);
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        }, true);
    }

    // Injection principale
    autoInjectFavorisTab();
    setupEmoteClick();

})();
