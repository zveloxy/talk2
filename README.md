# Talk2

> **Secure, ephemeral, and anonymous chat platform.**  

Talk2 is a privacy-focused real-time messaging application built with Node.js and Socket.io. It creates a space where conversations are guaranteed to be temporary. No logs are kept, no accounts are required, and everything—including shared media—is physically deleted after 24 hours.

![Talk2 Hero](./public/favicon.ico)

## 🚀 Features

- **Total Anonymity:** No sign-ups, emails, or phone numbers. Just pick a nickname and join.
- **Ephemeral Structure:**
  - **24h Auto-Destruct:** A server-side cron job wipes all data older than 24 hours.
  - **Instant File Deletion:** Deleting a message with an image instantly removes the file from the server storage.
- **Real-Time Experience:**
  - Powered by **Socket.io** for low-latency messaging.
  - Live **Typing Indicators**.
  - **User Presence** list with online status.
- **Smart UI/UX:**
  - **Glassmorphism Design:** A modern, dark-themed interface.
  - **Auto-Language Detection:** Automatically serves languages(TR/EN/DE/RU/ES/FR/IT/PT/PH) content based on user IP.
  - **Responsive:** Fully optimized for desktop, tablet, and mobile.
- **Session Persistence:** Intelligent session handling ensures you don't disconnect on page refreshes.

## 🛠️ Tech Stack

- **Backend:** Node.js, Express
- **Real-time:** Socket.io
- **Database:** Custom JSON-based In-Memory DB (No external dependencies like MySQL/Mongo needed)
- **Frontend:** Vanilla JS, CSS3 (Glassmorphism), HTML5
- **Utilities:** Multer (Uploads), Node-Cron (Cleanup), UUID

## 📦 Installation

1.  **Clone the repository**

    ```bash
    git clone https://github.com/yourusername/talk2.git
    cd talk2
    ```

2.  **Install Dependencies**

    ```bash
    npm install
    ```

3.  **Start the Server**

    ```bash
    npm start
    ```

    _or for development:_

    ```bash
    node server.js
    ```

4.  **Access the App**
    Open your browser and navigate to:
    `http://localhost:3000`

    _(Note: The server will automatically pick a free port if 3000 is occupied, check the console output)_

## 🔧 Configuration

- **Port:** Set the `PORT` environment variable to define a specific port.
  ```bash
  PORT=8080 npm start
  ```
- **Retention Policy:** Default is 24 hours. Modify `RETENTION_MS` in `server.js` to change this duration.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1.  Fork the project
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
