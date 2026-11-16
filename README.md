# StockCount

A Chrome-first inventory workspace for turning rough shelf notes into an editable count. The review screen shows the inference source reported by Firebase AI Logic and the excerpt supplied with each extracted row. The latest saved count stays in browser storage.

## Run the prototype

1. Use Node.js 24.12+ to meet the Firebase packages' declared engine requirements and run `npm ci`.
2. Run `npm run dev` for local development, or `npm run build` followed by `npm run preview` for the service-worker-backed build.
3. Use the printed localhost URL. Deploy the production build at the site root over HTTPS.

## Configure cloud fallback

1. In Firebase, create a project, register the Web app, and enable Firebase AI Logic using the Gemini Developer API.
2. Turn on and register Web App Check using reCAPTCHA Enterprise. Configure the preview or demo domain and Firebase AI Logic enforcement settings.
3. Copy `.env.example` to `.env.local` and fill the public Web app configuration and App Check site key. This app does not use a direct Gemini API key.
4. For a local Vite development session, set `VITE_APP_CHECK_DEBUG=true` in `.env.development.local`. Register Chrome's debug token privately in App Check. No reCAPTCHA site key is needed for the local debug provider. Use the production attestation provider for a public demo. Keep debug tokens out of commits and public links.

## Verify both inference paths

1. In desktop Chrome, follow Firebase's [hybrid setup guide](https://firebase.google.com/docs/ai-logic/hybrid/web/get-started) to enable the Prompt API and let Chrome download its Gemini Nano model. In the production preview, open the app once and wait for workspace caching.
2. Load the example, leave cloud fallback unchecked, and extract once online to initialize the model. Disconnect and reload. Repeat extraction and check that the review column displays **On-device Gemini**. Edit and save the result.
3. Reconnect and open the app in a browser profile where the Chrome Prompt API is unavailable. For a repeatable development test on the same Chrome, open `/?test=cloud-fallback` on the Vite development server, which disables the Prompt API for that test page through Permissions Policy. With cloud configured, load the example, opt in to fallback, and extract. Check for **Cloud Gemini**, edit a value, and save it.
4. Use synthetic shelf notes for the cloud test. No prior count is uploaded automatically.

Manual entry is available whether the device can run Gemini or not.

## Chrome milestone

On November 16, 2026, the cached production preview reloaded with the local test server stopped and page connections blocked. Firebase reported on-device inference and returned the three example quantities (20, 8, 12). The result saved and restored with the server still stopped. The measured local run took 117.7 seconds on the test computer.

The cloud test used the same Chrome with the Prompt API disabled on the test page and App Check enforced. Firebase reported cloud inference and returned the same quantities. The repeat run on the redesigned app took 2.7 seconds. The tests used synthetic notes. The production App Check provider and public demo hosting are still pending.

## Supplier invoice demo

1. In the cloud-enabled development build, load the sample shelf notes. Extract the count, review the three lines and save it. For this demo the tomato count is 20 cartons.
2. Go to **Compare invoice** and download the synthetic supplier PDF. Choose the file with the button or drop it onto the invoice area.
3. Approve sending that PDF to Gemini, then select **Compare with saved count**. Cloud Gemini reads the PDF and the browser compares it with the saved count. Only the selected PDF goes to Gemini.
4. Expect two matches and a four-carton short delivery for tomatoes (**24 billed, 20 counted**). Open **View invoice excerpt** and compare the transcription against the PDF. Product names and units must agree after case and whitespace normalization. Multiple or unmatched lines go to review.

The example passed in Chrome through Firebase AI Logic with App Check on November 16, 2026.

## Hackathon submission

The target is Best Web/Chrome App at [#BuildHybridAI 2026](https://firebasehybridaihackathon.devpost.com/). The entry closes November 30, 2026 at 11:00 p.m. WAT. Submit an English project description, a public GitHub or GitLab repository with a visible open-source license and run instructions, and a public YouTube demo up to three minutes. A hosted test URL is strongly encouraged. The local checkout includes an Apache 2.0 license and a synthetic demo invoice.

For the video, show the problem and sample notes first. Show the on-device result after disconnected reload and identify any edited wait honestly. Demonstrate the cloud fallback indicator and the PDF comparison, then show the four-carton discrepancy and its source line. The public build, repository, video, and final eligibility attestations remain pending.

For Firebase Hosting, register the production host with the reCAPTCHA Enterprise web provider, set the production configuration from `.env.example`, and build with `npm run build`. With the Firebase CLI authenticated to the intended project, run `firebase deploy --only hosting --project YOUR_PROJECT_ID`. The committed Hosting configuration serves the compiled workspace and allows Chrome to check for service worker updates.
