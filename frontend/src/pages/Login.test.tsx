import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import api from '../api/client';

jest.mock('../api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const mockApi = api as jest.Mocked<typeof api>;

describe('Login 登录页', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('渲染用户名与密码输入框', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );
    expect(screen.getByPlaceholderText('用户名')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('密码')).toBeInTheDocument();
  });

  it('登录成功后保存 token', async () => {
    (mockApi.post as jest.Mock).mockResolvedValue({
      data: {
        access_token: 'test-token',
        user: { username: 'admin', role: 'admin' },
      },
    });
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByPlaceholderText('用户名'), {
      target: { value: 'admin' },
    });
    fireEvent.change(screen.getByPlaceholderText('密码'), {
      target: { value: 'admin123' },
    });
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(localStorage.getItem('token')).toBe('test-token');
    });
  });
});
