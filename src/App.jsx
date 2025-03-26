// App.jsx
// Главный компонент приложения. Здесь настроены маршруты для регистрации и главной страницы.

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AuthPage from '../components/AuthPage';
import MainPage from '../components/MainPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AuthPage />} />
        <Route path="/main" element={<MainPage />} />
      </Routes>
    </Router>
  );
}

export default App;