import zipfile, re, sys

aab = r"D:\apps\rentzu\build-output\rentzu-v1.0.0-vc5-sdk57.aab"
z = zipfile.ZipFile(aab)

# 1) JS bundle checks
bundle_name = None
for n in z.namelist():
    if n.endswith("index.android.bundle"):
        bundle_name = n
        break

print("=== JS BUNDLE ===")
if bundle_name:
    data = z.read(bundle_name)
    print(f"bundle: {bundle_name}  ({len(data)/1024/1024:.1f} MB)")
    urls = set(re.findall(rb"https://[a-z0-9\-\.]+trycloudflare\.com", data))
    print("tunnel URLs found:", [u.decode() for u in urls] or "NONE")
    print("contains 10.0.2.2 :", b"10.0.2.2" in data)
    print("contains expo-av  :", b"expo-av" in data)
else:
    print("no JS bundle found!")

# 2) targetSdkVersion from protobuf-encoded manifest
print("\n=== ANDROID MANIFEST ===")
mf = z.read("base/manifest/AndroidManifest.xml")
for attr in (b"minSdkVersion", b"targetSdkVersion", b"compileSdkVersion", b"versionCode"):
    idx = 0
    vals = []
    while True:
        i = mf.find(attr, idx)
        if i < 0:
            break
        window = mf[i:i + 60]
        # protobuf varints for the int value appear shortly after the attr name
        nums = re.findall(rb"\x18([\x00-\xff])", window)
        cands = [b[0] for b in nums if 1 <= b[0] <= 200]
        vals.extend(cands)
        idx = i + 1
    print(f"{attr.decode():>18}: candidates {sorted(set(vals))}")
