import React, { useState } from 'react';
import { Tabs, Form, Input, Button, Typography } from 'antd';
import 'antd/dist/antd.css';
import '../src/AuthPage.css'; // Подключение файла со стилями

const { Title } = Typography;
const { TabPane } = Tabs;

const AuthPage = () => {
  const [identifier, setIdentifier] = useState('');

  // Функция для генерации уникального идентификатора
  const generateIdentifier = () => {
    // Здесь должна быть логика для запроса к серверу и получения уникального идентификатора
    const newIdentifier = 'A1B2C3D4'; // Пример идентификатора
    setIdentifier(newIdentifier);
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <Title level={2} className="logo">
          <img src="/path-to-logo.png" alt="Phantom Logo" className="logo-image" />
          Phantom
        </Title>
        <Tabs defaultActiveKey="1" centered>
          <TabPane tab="Войти" key="1">
            <Form
              name="login"
              initialValues={{ remember: true }}
              onFinish={(values) => console.log('Вход с данными:', values)}
            >
              <Form.Item
                name="username"
                rules={[{ required: true, message: 'Пожалуйста, введите ваш логин!' }]}
              >
                <Input placeholder="Логин" />
              </Form.Item>
              <Form.Item
                name="password"
                rules={[{ required: true, message: 'Пожалуйста, введите ваш пароль!' }]}
              >
                <Input.Password placeholder="Пароль" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" block>
                  Войти
                </Button>
              </Form.Item>
            </Form>
          </TabPane>
          <TabPane tab="Регистрация" key="2">
            <Form
              name="register"
              initialValues={{ remember: true }}
              onFinish={(values) => console.log('Регистрация с данными:', values)}
            >
              <Form.Item>
                <Input
                  value={identifier}
                  placeholder="Уникальный идентификатор"
                  readOnly
                  addonAfter={
                    <Button onClick={generateIdentifier} type="link">
                      Сгенерировать
                    </Button>
                  }
                />
              </Form.Item>
              <Form.Item
                name="username"
                rules={[{ required: true, message: 'Пожалуйста, введите ваш логин!' }]}
              >
                <Input placeholder="Логин" />
              </Form.Item>
              <Form.Item
                name="password"
                rules={[{ required: true, message: 'Пожалуйста, введите ваш пароль!' }]}
              >
                <Input.Password placeholder="Пароль" />
              </Form.Item>
              <Form.Item
                name="confirm"
                dependencies={['password']}
                hasFeedback
                rules={[
                  { required: true, message: 'Пожалуйста, подтвердите ваш пароль!' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('Пароли не совпадают!'));
                    },
                  }),
                ]}
              >
                <Input.Password placeholder="Подтвердите пароль" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" block>
                  Зарегистрироваться
                </Button>
              </Form.Item>
            </Form>
          </TabPane>
        </Tabs>
      </div>
    </div>
  );
};

export default AuthPage;