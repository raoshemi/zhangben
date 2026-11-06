import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MainLayout from './MainLayout';
import api from '../api/client';

jest.mock('../api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

describe('MainLayout 菜单分组', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockResolvedValue({ data: [] });
    localStorage.clear();
  });

  it('按业务流分组，并把账套/科目等全局配置收进系统设置', async () => {
    render(
      <MemoryRouter initialEntries={['/vouchers']}>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route path="vouchers" element={<div>凭证页</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    // 菜单分组 + 面包屑都会出现当前分组名，这里只校验存在
    expect((await screen.findAllByText('日常核算')).length).toBeGreaterThan(0);
    expect(screen.getByText('账簿与报表')).toBeInTheDocument();
    expect(screen.getByText('期末')).toBeInTheDocument();
    expect(screen.getByText('系统设置')).toBeInTheDocument();

    // 业务入口只出现一次，全局配置不再平铺在一级菜单
    expect(screen.getAllByText('凭证管理').length).toBeGreaterThan(0);
    expect(screen.queryByText('辅助核算')).not.toBeInTheDocument();
    expect(await screen.findByText('凭证页')).toBeInTheDocument();
  });
});
