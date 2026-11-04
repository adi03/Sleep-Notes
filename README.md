# To Do List for CrossPoint

Send a to-do list from your phone or computer to your Xteink X3 or X4 and see it every time the reader sleeps.

<p align="center">
  <img src="docs/grocery-list-sleep-screen.jpg" alt="An Xteink X3 showing a grocery list as its sleep screen" width="320">
</p>

To Do List is a plugin for CrossPoint 2.0. It adds a **To Do List** card to the reader's web File Manager page:

- **Saves each list** as a plain `.txt` file in `/Notes`, so you can also open it from the Library like a book. Right-to-left text such as Arabic works too.
- **Turns the list into your sleep screen.** When you press **Save to reader**, the card draws the list as `/sleep/note.bmp`.
- **Works from any browser.** Type a list on the card from a phone, tablet or computer, or open it from a link with the list already filled in. On iPhone, the Apple Shortcut below does that for you.

## Install

1. Install **To Do List** from Plugin Hub, or copy the `to-do-list.crosspoint-plugin` folder to the SD card as `/plugins/to-do-list/`.
2. On the reader, turn on **Settings → Connectivity → Plugins**.
3. Set **Settings → Display → Sleep Screen → Custom**.

Requires CrossPoint 2.0 or later.

## iPhone Shortcut: "Send Sleep Note"

The quickest way to use the plugin is the ready-made Apple Shortcut.

**[Get the "Send Sleep Note" shortcut](https://www.icloud.com/shortcuts/8f597c245bcf4871993a44c5b4aca441)**

Open the link on your iPhone and tap **Add Shortcut**.

### Using it

1. On the reader, open **File Transfer** and join your home WiFi.
2. On the iPhone, connected to the same WiFi, open a note or list and tap **Share → Send Sleep Note**.
3. Safari opens the To Do List card with your list filled in. Check it, then press **Save to reader**.
4. Wait for **Done** on the card, then put the reader to sleep. Your list is the sleep screen.

### Tips

- **Allow local network access.** The first time the shortcut runs, iOS asks whether Shortcuts can reach devices on your local network. Tap **Allow**.
- **If `crosspoint.local` doesn't load,** edit the shortcut and replace `crosspoint.local` with the IP address shown on the reader's File Transfer screen.
- **Only the list is shown.** Saving deletes any other `.bmp` files in `/sleep`, along with CrossPoint's cached sleep images, so your list is the only sleep image. Move pictures you want to keep out of `/sleep` first.

## Other devices

On Android, a tablet or a computer:

1. Put the reader in **File Transfer** on the same WiFi.
2. Open `http://crosspoint.local/files` in a browser.
3. Type your list on the To Do List card and press **Save to reader**.

To skip the typing, have an automation app or script open a link in the format below.

### Link format

The card fills itself in from a link like this:

```
http://crosspoint.local/files#title=<URL-encoded title>&body=<URL-encoded list>
```

To build your own Apple Shortcut, a minimal version has three actions: **Get Text from Input** → **URL Encode** → **Open URLs** `http://crosspoint.local/files#note=[URL Encoded Text]`. With `#note=`, the first line becomes the title.

The part after `#` stays in the browser and is never sent to the reader in the address, so long lists, `&`, `+` and emoji are fine. Nothing is uploaded until you press **Save to reader**.

## How it works

Plugins can't run code on the reader itself, so the card does the work in your browser:

- Each list is saved as `/Notes/<date> <title>.txt`.
- The sleep image is drawn as a 24-bit uncompressed BMP, the format CrossPoint's Custom sleep screen needs. It is 528×792 for the X3 and 480×800 for the X4; choose your device on the card.
- Before uploading, the card deletes the `.bmp` files already in `/sleep`. It also deletes CrossPoint's cached sleep images: `.bmp` files at the top of `/.crosspoint` whose name contains `sleep`.
- Tap **Wallpaper** next to any saved list to make it the sleep screen again.
