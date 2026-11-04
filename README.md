# To Do List for CrossPoint

A CrossPoint plugin that keeps notes on your Xteink X3/X4 as plain `.txt` files in `/Notes`, so the built-in TXT reader opens them (right-to-left text included).

- **From iPhone Notes:** a share-sheet Shortcut uploads the note straight to the reader over home WiFi (see below).
- **From any browser:** a card on the reader's File Manager page to write, list and delete notes.
- **Sleep screen:** the card draws the newest note and saves it as `/sleep/note.bmp` (24-bit uncompressed BMP, 528×792 for the X3 or 480×800 for the X4), which CrossPoint shows when the Sleep Screen setting is **Custom**. Every `.bmp` already in `/sleep` is deleted first, so the note is the only sleep image, and so are CrossPoint's cached sleep images (`.bmp` files in `/.crosspoint` whose name contains `sleep`). Plugins can't run code on the reader, so this happens in the browser when you press **Save to reader** (with *Also set as sleep wallpaper* ticked) or tap **Wallpaper** next to a note. Opening the page never uploads anything by itself.

## Install

Install **To Do List** from Plugin Hub, or copy the `to-do-list.crosspoint-plugin` folder to the SD card as `/plugins/to-do-list/`, then enable **Settings → Connectivity → Plugins**. Requires CrossPoint 2.0 or later.

## iPhone Shortcut: "Send Sleep Note"

1. **Shortcut settings:** turn on *Show in Share Sheet*. Receive **Text** and **Rich Text**. If there's no input, choose **Ask For Text**.
2. **Format Date:** Current Date, custom format `yyyy-MM-dd HHmm`.
3. **Get First Item from List:** Split *Shortcut Input* by New Lines, then take the first item. This becomes the title.
4. **Replace Text:** in the title, use the regular expression `[\\/:*?"<>|]` and replace it with nothing.
5. **Text:** `Formatted Date Updated Text` (the date, a space, then the cleaned title).
6. **Set Name:** set the name of *Shortcut Input* to the text from step 5, followed by `.txt`.
7. **Get Contents of URL:**
   - URL: `http://crosspoint.local/upload?path=/Notes`
   - Method: **POST**
   - Request Body: **Form**
   - Add one field of type **File**, with key `file` and the renamed item as its value.
8. **Show Notification:** "Sent to X3".

On the first run, allow Shortcuts to access devices on your local network. The reader must be in File Transfer mode, on the same WiFi as the phone.

## Prefill the card from a link

Open `http://crosspoint.local/files#note=<URL-encoded note>` and the To Do List card fills itself in (first line as the title), ready for **Save to reader**. `#title=…&body=…` also works. The part after `#` stays in the browser, so long notes are fine.

Shortcut for this: **Get Text from Input** → **URL Encode** (Encode) → **Open URLs** `http://crosspoint.local/files#note=[URL Encoded Text]`.

iCloud Link to Shortcut:

https://www.icloud.com/shortcuts/8f597c245bcf4871993a44c5b4aca441

