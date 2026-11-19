# The Pelican Test — 1080p60 (split)

GitHub refuses single files over 100 MB, so the 1080p60 film (277 MB) is stored here as three parts.
Download all three `.part` files into one folder, then join them:

**macOS / Linux** (Terminal, in that folder):

    cat the-pelican-test-1080p60.mp4.part00 the-pelican-test-1080p60.mp4.part01 the-pelican-test-1080p60.mp4.part02 > the-pelican-test-1080p60.mp4

**Windows** (Command Prompt, in that folder):

    copy /b the-pelican-test-1080p60.mp4.part00 + the-pelican-test-1080p60.mp4.part01 + the-pelican-test-1080p60.mp4.part02 the-pelican-test-1080p60.mp4

**Windows** (PowerShell):

    cmd /c copy /b the-pelican-test-1080p60.mp4.part00 + the-pelican-test-1080p60.mp4.part01 + the-pelican-test-1080p60.mp4.part02 the-pelican-test-1080p60.mp4

Check it (optional) — the result must match `SHA256SUMS.txt`:

    shasum -a 256 the-pelican-test-1080p60.mp4        # macOS
    sha256sum the-pelican-test-1080p60.mp4            # Linux
    certutil -hashfile the-pelican-test-1080p60.mp4 SHA256   # Windows

Or skip all of this: `git clone https://github.com/realfang102/pelican` and run the join command inside `film/1080p/`.
