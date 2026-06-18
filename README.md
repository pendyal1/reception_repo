# Pallavi & Aditya Reception Site

Fancy floral Evite-style reception site with Google sign-in, RSVP collection, private guest photo uploads, and a couple-only dashboard.

## What is included

- Static GitHub Pages frontend, no build step required.
- Google sign-in through Firebase Authentication.
- RSVP storage in Cloud Firestore.
- Private image uploads in Cloud Storage for Firebase.
- Admin-only RSVP and upload dashboard.
- Firestore and Storage security rules that prevent guests from viewing uploaded photos.
- GitHub Actions workflow for GitHub Pages hosting.

## Local Preview

Run a local server from the repo root:

```bash
python3 -m http.server 4173
```

Then open:

```text
http://localhost:4173
```

The page renders without Firebase configured, but sign-in, RSVP, and uploads require a real Firebase project.

## Firebase / Google Cloud Setup

Firebase runs on Google Cloud and is the simplest backend for this site.

1. Create or open a Firebase project.
2. Add a Web app in Firebase project settings.
3. Enable Authentication, then enable the Google provider.
4. Create a Cloud Firestore database.
5. Create a Cloud Storage for Firebase bucket.
6. Copy `src/firebase-config.example.js` to `src/firebase-config.js`.
7. Paste the Firebase web config into `src/firebase-config.js`.
8. Add your deployed GitHub Pages domain in Firebase Authentication authorized domains.
9. Deploy rules:

```bash
firebase deploy --only firestore:rules,storage
```

The Firebase web config is safe to ship in frontend code. The privacy boundary is enforced by `firestore.rules` and `storage.rules`.

## Couple/Admin Access

After you and your fiance sign in once, copy each Firebase Auth UID into Firestore:

```text
admins/{uid}
```

The document can be empty. Any signed-in UID with an `admins/{uid}` document can view all RSVPs and photo uploads. Guests can upload photos, but they cannot read, list, or download uploads.

For first-time bootstrapping, create the first admin document manually in the Firebase console. After that, admins can manage admin documents if you add a small management screen later.

## GitHub Pages Hosting

The workflow in `.github/workflows/deploy-pages.yml` deploys the repo root when code is pushed to `main`.

In GitHub:

1. Go to Settings > Pages.
2. Set Source to GitHub Actions.
3. Push to `main`.

## Files

- `index.html` - invitation, RSVP, upload, and dashboard markup.
- `styles.css` - floral invitation styling based on the poster artwork.
- `src/main.js` - Firebase Auth, RSVP, upload, and admin dashboard logic.
- `src/firebase-config.js` - Firebase config placeholder.
- `firestore.rules` - Firestore privacy rules.
- `storage.rules` - private upload rules.
- `assets/reception-poster.png` - uploaded poster artwork used as the visual anchor.

## Design Notes

The page uses the uploaded poster as the primary art direction: dark garden greens, maroon paneling, gold borders, pale script, floral density, and South Asian reception details. The guest workflow stays intentionally simple: details, RSVP, private upload.
