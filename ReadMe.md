# 🗺️ 3D Web Map Editor (CesiumJS)

## 📌 Projektbeschreibung

Dieses Projekt ist ein prototypischer **webbasierter 3D-Karteneditor**, der auf **CesiumJS** basiert.
Er ermöglicht das **Laden, Platzieren und Interagieren mit 3D-Modellen (GLB/GLTF)** direkt in einer realen Umgebung (z. B. Berlin).

Der Fokus liegt auf der Untersuchung interaktiver Funktionen für Stadtplanung und 3D-Webanwendungen.

---

## 🏗️ Projektstruktur

```
project/
│── index.html      # Hauptseite
│── styles.css      # Styling der UI
│── app.js          # Hauptlogik (Cesium + Interaktionen)
│── /assets         # 3D Modelle (zum Hinzufügen)
│── /icon           # UI Icons
```

---

## ⚙️ Installation & Nutzung

### 1. Projekt klonen

```bash
git clone <repo-url>
cd project
```

## 🔑 Cesium Token

Für die Nutzung von Cesium Ion benötigst du einen Access Token:

1. Registrieren auf: https://ion.cesium.com/signin/tokens
2. Token generieren
3. In `app.js` eintragen/ersetzen:

```javascript
Cesium.Ion.defaultAccessToken = "DEIN_TOKEN";
```

---

### 2. Lokalen Server starten (wichtig!)

Da Cesium WebGL nutzt, wird ein Server benötigt:

**Optionen:**

```bash
# Python
python -m http.server 8080

# Node.js
npx serve
```

### 3. Anwendung öffnen

```
http://localhost:8080
```

---

## 🎮 Steuerung

### Kamera

| Taste         | Funktion       |
| ------------- | -------------- |
| W / A / S / D | Kamera bewegen |
| Maus          | Blickrichtung  |

### Objekte

| Aktion      | Funktion           |
| ----------- | ------------------ |
| Klick       | Objekt auswählen   |
| Pfeiltasten | Bewegen / Rotieren |
| Drag & Drop | Position verändern |

---

## 📦 Unterstützte Formate

* `.glb`
* `.gltf`

---

## 🧠 Technische Grundlagen

* **WebGL** (über CesiumJS)
* **3D Tiles / OSM Buildings**
* **Geokoordinaten (WGS84)**
* **Terrain Sampling**
* **Raycasting zur Kollisionsprüfung**

---

## ⚠️ Bekannte Einschränkungen

* Kollisionsprüfung basiert auf Raycasting (nicht 100% exakt)
* Performance abhängig von Modellgröße
* Keine Persistenz (Objekte werden nicht gespeichert)
* Drag & Drop kann bei komplexem Terrain ungenau sein
* Mehrmaliges Laden kann nötig sein
---

## 📚 Kontext (Forschung)

Dieses Projekt dient als Grundlage zur Evaluation von Web-Frameworks für:

* 3D-Web-Visualisierung
* Stadtplanung

---

## 👩‍💻 Autorin

Katharina Geburtig

---

## 📄 Lizenz

Dieses Projekt dient zu Forschungs- und Demonstrationszwecken.
