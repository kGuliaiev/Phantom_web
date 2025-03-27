import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Logout = () => {
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.clear(); // или удалить только нужные поля
    console.log('🗑️ Данные удалены из localStorage');
    navigate('/'); // или navigate('/auth')
    window.location.reload(); // принудительно перезапустить приложение
  }, []);

  return null;
};

export default Logout;