# 🏝️ Île Sauvage — FPS / survie multijoueur (web)

Jeu 3D dans le navigateur (Three.js), à jouer à deux (ou plus) **sans serveur** : la connexion se fait en pair-à-pair (WebRTC via PeerJS). Le site est 100 % statique, donc compatible **GitHub Pages**.

## Mettre en ligne sur GitHub Pages

1. Crée un dépôt GitHub et envoie-y le contenu de ce dossier (`index.html`, `style.css`, `js/`, `assets/` éventuel).
2. Dépôt → **Settings → Pages** → Source : *Deploy from a branch* → branche `main`, dossier `/ (root)` → Save.
3. Après une minute, le jeu est sur `https://<ton-pseudo>.github.io/<depot>/`.

Pour tester en local : `python3 -m http.server 8000` dans le dossier puis ouvre `http://localhost:8000` (les modules ES ne marchent pas en `file://`).

## Jouer avec un ami

- Toi : choisis un mode → **Créer** → un code à 5 caractères s'affiche en haut à gauche.
- Ton ami : ouvre la même URL → entre le code → **Rejoindre**.
- Ton onglet est le « serveur » : s'il se ferme, la partie s'arrête. Si la connexion échoue (réseaux d'entreprise / box très stricte), il faudrait ajouter un serveur TURN (voir `peerjs` → option `config.iceServers`).

## Modes de jeu

| Mode | Règle |
|---|---|
| Survie coopérative | Récolter, fabriquer, construire, survivre aux ours et loups. Pas de dégâts entre joueurs. |
| Équipe vs bots IA | Les joueurs contre des bots tireurs. Premier camp à 20 éliminations. Équipement fourni. |
| Duel 1v1 | Premier à 5 éliminations. Équipement fourni. |
| 1v1 Trésor | Un coffre est caché sur l'île : la distance s'affiche en haut à droite. Premier à l'ouvrir (E) gagne. PvP activé. |

## Contrôles

ZQSD / WASD · Espace sauter · Maj courir · Clic gauche frapper/tirer/poser · **1-9** objet · **Tab/I** inventaire + craft · **B** construction (1-4 pièce, R matériau bois/pierre) · **E** buggy / coffre · **F** manger de la viande.

## Progression

- Bois (arbres), pierre (rochers), **fer** (minerai orange, dans les montagnes et les **caves**).
- Poings → pioche / batte / lance → **établi** (10 bois + 4 pierre) → **acier** (2 fer + 2 bois) → pioche et lance en fer, épée en acier, arc, fusil → **buggy** (15 bois, 8 fer, 2 acier).
- Construction : sol, mur, porte, toit en bois ou en pierre.

## Animations Mixamo (optionnel)

Sans fichiers, le jeu utilise des personnages/animaux « boîtes » animés par code. Pour les vrais modèles :

1. Sur [mixamo.com](https://www.mixamo.com), choisis un personnage → télécharge en **FBX, With Skin** → `assets/mixamo/character.fbx`.
2. Télécharge ces animations en **FBX, Without Skin, option « In Place »** : `idle.fbx`, `walk.fbx`, `run.fbx`, `attack.fbx` (+ `death.fbx` si tu veux) dans `assets/mixamo/`.
3. Recharge : le jeu les détecte tout seul (si tes fichiers manquent, il retombe sur les modèles simples).

⚠️ **Mixamo ne propose pas d'animaux** (humanoïdes uniquement). Pour les ours/loups/cerfs/sangliers, dépose des modèles animés au format `.glb` dans `assets/animals/` nommés `bear.glb`, `wolf.glb`, `deer.glb`, `boar.glb`. Les clips dont le nom contient `idle`, `walk`, `run`, `attack` sont utilisés automatiquement. Des packs gratuits existent (Quaternius, Kenney, Poly Pizza).

L'orientation de l'arme tenue en main avec un modèle Mixamo se règle dans `Actor.setItem` (`js/entities.js`).

## Structure

- `js/world.js` : île procédurale, biomes (forêt, neige, désert, marais, montagne, plage), caves, collisions, construction.
- `js/entities.js` : personnages, animaux, armes, chargement Mixamo/GLB.
- `js/net.js` : réseau PeerJS (l'hôte est autoritaire sur animaux, bots, ressources, scores).
- `js/game.js` : joueur, combat, craft, véhicules, IA, modes de jeu, interface.
