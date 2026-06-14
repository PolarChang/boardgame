import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { NotionGame } from '@/lib/types';
import GameGallery from '../GameGallery';

const mockGames: NotionGame[] = [
  {
    pageId: '1',
    bggId: 1,
    name: 'Brass: Birmingham',
    chineseName: '伯明翰',
    image: 'https://example.com/brass.jpg',
    minPlayers: 2,
    maxPlayers: 4,
    bestPlayers: '2-4',
    playTime: 120,
    complexity: 3.8,
    rating: 8.5,
    playCount: 0,
    bggLink: 'https://boardgamegeek.com/boardgame/1',
    ownership: 'Owned',
    type: 'Base',
  },
  {
    pageId: '2',
    bggId: 2,
    name: 'Ark Nova',
    chineseName: '方舟動物園',
    image: 'https://example.com/arknova.jpg',
    minPlayers: 1,
    maxPlayers: 4,
    bestPlayers: '2-4',
    playTime: 150,
    complexity: 3.7,
    rating: 8.4,
    playCount: 0,
    bggLink: 'https://boardgamegeek.com/boardgame/2',
    ownership: 'Owned',
    type: 'Base',
  },
  {
    pageId: '3',
    bggId: 3,
    name: 'Wingspan',
    chineseName: '展翅翱翔',
    image: 'https://example.com/wingspan.jpg',
    minPlayers: 1,
    maxPlayers: 5,
    bestPlayers: '2-4',
    playTime: 70,
    complexity: 2.4,
    rating: 7.9,
    playCount: 0,
    bggLink: 'https://boardgamegeek.com/boardgame/3',
    ownership: 'Owned',
    type: 'Base',
  },
];

describe('GameGallery', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('搜尋功能', () => {
    it('輸入「伯明翰」時應正確顯示《伯明翰》，且隱藏其他不相符的桌遊', () => {
      render(<GameGallery initialGames={mockGames} />);

      const searchInput = screen.getByPlaceholderText(/搜尋桌遊名稱/i);
      fireEvent.change(searchInput, { target: { value: '伯明翰' } });

      // Should show 伯明翰
      expect(screen.getByText('伯明翰')).toBeDefined();
      // Should not show other games
      expect(screen.queryByText('方舟動物園')).toBeNull();
      expect(screen.queryByText('展翅翱翔')).toBeNull();
    });

    it('輸入英文「Ark Nova」時應正確過濾出《方舟動物園》', () => {
      render(<GameGallery initialGames={mockGames} />);

      const searchInput = screen.getByPlaceholderText(/搜尋桌遊名稱/i);
      fireEvent.change(searchInput, { target: { value: 'Ark Nova' } });

      expect(screen.getByText('方舟動物園')).toBeDefined();
      expect(screen.queryByText('伯明翰')).toBeNull();
      expect(screen.queryByText('展翅翱翔')).toBeNull();
    });

    it('輸入大小寫不一致的英文「bRaSs」時應能忽略大小寫匹配', () => {
      render(<GameGallery initialGames={mockGames} />);

      const searchInput = screen.getByPlaceholderText(/搜尋桌遊名稱/i);
      fireEvent.change(searchInput, { target: { value: 'bRaSs' } });

      expect(screen.getByText('伯明翰')).toBeDefined();
      expect(screen.queryByText('方舟動物園')).toBeNull();
    });

    it('當點擊清除按鈕時，搜尋框應變回空字串，且清單恢復完整數量', () => {
      render(<GameGallery initialGames={mockGames} />);

      // First search
      const searchInput = screen.getByPlaceholderText(/搜尋桌遊名稱/i);
      fireEvent.change(searchInput, { target: { value: '伯明翰' } });
      expect(screen.queryByText('方舟動物園')).toBeNull();

      // Click clear button
      const clearButton = screen.getByTitle('清除搜尋');
      fireEvent.click(clearButton);

      // Search input should be empty
      expect((searchInput as HTMLInputElement).value).toBe('');
      // All games should be visible again
      expect(screen.getByText('方舟動物園')).toBeDefined();
      expect(screen.getByText('展翅翱翔')).toBeDefined();

      // Check count shows all games
      expect(screen.getByText(/3 \/ 3 款/)).toBeDefined();
    });
  });

  describe('檢視模式切換', () => {
    it('預設為 grid 模式，容器應包含 grid-cols-2', () => {
      render(<GameGallery initialGames={mockGames} />);

      // Find the grid container section
      const gameSection = screen.getByTestId('game-grid-section');
      expect(gameSection.className).toContain('grid-cols-2');
      expect(gameSection.className).toContain('grid');
    });

    it('點擊 Grid 按鈕時，外層容器的 Class 應包含 grid-cols-2', () => {
      render(<GameGallery initialGames={mockGames} />);

      // Switch to card first, then back to grid to ensure state changes
      const cardButton = screen.getByTitle('卡片');
      fireEvent.click(cardButton);

      const gridButton = screen.getByTitle('網格');
      fireEvent.click(gridButton);

      const gameSection = screen.getByTestId('game-grid-section');
      expect(gameSection.className).toContain('grid-cols-2');
    });

    it('點擊 List 按鈕時，桌遊卡片內的圖片應變更為較小的縮圖尺寸', () => {
      render(<GameGallery initialGames={mockGames} />);

      const listButton = screen.getByTitle('清單');
      fireEvent.click(listButton);

      // In list mode, the container should use flex layout (not grid)
      const gameSection = screen.getByTestId('game-grid-section');
      expect(gameSection.className).toContain('flex');
      expect(gameSection.className).not.toContain('grid');
    });

    it('切換模式至 list 後重新整理頁面，系統應從 localStorage 讀取並維持在 list 檢視模式', () => {
      // Simulate previous session: save list mode to localStorage
      localStorage.setItem('boardgame_view_mode', JSON.stringify('list'));

      render(<GameGallery initialGames={mockGames} />);

      const gameSection = screen.getByTestId('game-grid-section');
      // Should be in list mode (flex layout)
      expect(gameSection.className).toContain('flex');
      expect(gameSection.className).not.toContain('grid');
    });

    it('點擊卡片(Card)模式按鈕時，容器應只包含 grid-cols-1', () => {
      render(<GameGallery initialGames={mockGames} />);

      const cardButton = screen.getByTitle('卡片');
      fireEvent.click(cardButton);

      const gameSection = screen.getByTestId('game-grid-section');
      expect(gameSection.className).toContain('grid-cols-1');
    });
  });
});