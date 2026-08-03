# Rentzu Expo Go Loading Issue — Diagnosis & Fix

## Symptom
- Expo Go on Android emulator and iOS physical device showed a persistent loading spinner.
- Metro terminal showed `"No apps connected"` when trying to send the dev menu command.
- Manually entering the LAN URL in Expo Go did not connect.

## Root Cause
**Metro/Expo was started from the wrong working directory.**

The Rentzu repository has two important folders:
- `D:\apps\rentzu\` — repository root
- `D:\apps\rentzu\app\` — Expo/React Native project

The Expo project lives entirely in `D:\apps\rentzu\app\`. It contains:
- `package.json`
- `app.config.js` / `app.json`
- `App.tsx`
- `src/` services and screens
- `node_modules/`

Starting Expo from `D:\apps\rentzu\` caused Metro to look for `D:\apps\rentzu\package.json`, which does not exist. This led to:
- `ConfigError: The expected package.json path: D:\apps\rentzu\package.json does not exist`
- Metro not properly serving the JS bundle for the app
- Expo Go timing out / spinning while waiting for a valid bundle manifest

A secondary contributing factor was **network mode**. Earlier LAN-mode runs (`192.168.1.105:8081`) showed odd 404s to Metro endpoints and poor connectivity from the emulator to the host Metro server. Tunnel mode (`exp.direct`) is more reliable because it bypasses local LAN routing issues between the emulator/device and the Metro bundler.

## Fix
Run Expo from the correct project directory, and use tunnel mode for reliability:

```bash
cd D:\apps\rentzu\app
npx expo start --clear --tunnel
```

Then in the Metro terminal press `a` to open Android. The app should bundle and load normally.

## Evidence of Success
- Metro terminal output:
  - `Tunnel connected.`
  - `Tunnel ready.`
  - `Android Bundled 7379ms D:\apps\rentzu\app\node_modules\expo\AppEntry.js (850 modules)`
- Expo Go displayed the actual RentZu login screen instead of the loading spinner.

## Takeaways / Checklist
1. Always run `npx expo start` from the folder that contains `package.json` and the Expo app files.
2. If Expo Go shows `ConfigError` about missing `package.json`, you are in the wrong directory.
3. If the emulator/device cannot reach Metro over LAN, use `--tunnel` instead of `--lan`.
4. Use `--clear` after changing directories or if you see cached bundler errors.
