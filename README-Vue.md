# Test Automation Web - Vue 3 Version

This is a Vue 3 + Vite version of the Test Automation Web application.

## Setup

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```
The application will open at `http://localhost:5173`

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

## Features

- **Login System**: Authenticate with predefined users
- **Session Management**: User sessions stored in localStorage
- **Navigation Bar**: Shows menu items and user profile
- **Responsive Design**: Mobile-friendly layout
- **Logout Functionality**: Dropdown menu for signing out

## Test Users

- Email: `admin@admin.com` | Password: `2020`
- Email: `biancunha@gmail.com` | Password: `123456`
- Email: `growdev@growdev.com.br` | Password: `growdev123`

## Project Structure

```
src/
├── main.js          # Vue app entry point
└── App.vue          # Main application component

public/
├── css/style.css    # Application styles
├── img/             # Images (bg1.jpg, bg2.jpg, icon.png)
└── js/              # Original JavaScript files (for reference)
```

## Technologies

- **Vue 3**: Progressive JavaScript framework
- **Vite**: Next generation frontend tooling
- **CSS**: Custom styling with responsive design
- **LocalStorage**: Session persistence

