import { test, expect } from '@playwright/test';

test.describe('Game Catalog Filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows accessible controls and the complete catalog initially', async ({ page }) => {
    await test.step('Verify the filter structure and labels', async () => {
      await expect(page.getByRole('heading', { name: 'Filter games' })).toBeVisible();
      await expect(page.getByRole('group', { name: 'Categories' })).toBeVisible();
      await expect(page.getByRole('checkbox', { name: 'Strategy' })).toBeVisible();
      await expect(page.getByRole('combobox', { name: 'Publisher' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Clear filters' })).toBeDisabled();
    });

    await test.step('Verify the initial result count', async () => {
      await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(21);
      await expect(page.getByTestId('game-filter-summary')).toHaveText('21 of 21 games shown.');
    });
  });

  test('matches any selected category', async ({ page }) => {
    await test.step('Filter to one category', async () => {
      await page.getByRole('checkbox', { name: 'Strategy' }).check();
      await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(4);
      await expect(page.getByTestId('game-filter-summary')).toHaveText('4 of 21 games shown.');
    });

    await test.step('Add a second category with OR semantics', async () => {
      await page.getByRole('checkbox', { name: 'Puzzle' }).check();
      await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(8);
      await expect(page.getByTestId('game-filter-summary')).toHaveText('8 of 21 games shown.');
    });
  });

  test('combines a publisher with selected categories', async ({ page }) => {
    await test.step('Filter to one publisher', async () => {
      await page.getByRole('combobox', { name: 'Publisher' }).selectOption({
        label: 'CodeForge Studios',
      });
      await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(6);
      await expect(page.getByTestId('game-filter-summary')).toHaveText('6 of 21 games shown.');
    });

    await test.step('Combine the publisher with category filters', async () => {
      await page.getByRole('checkbox', { name: 'Strategy' }).check();
      await page.getByRole('checkbox', { name: 'Puzzle' }).check();
      await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(2);
      await expect(page.getByTestId('game-filter-summary')).toHaveText('2 of 21 games shown.');
    });
  });

  test('clears every selection and restores all games', async ({ page }) => {
    await page.getByRole('checkbox', { name: 'Action' }).check();
    await page.getByRole('combobox', { name: 'Publisher' }).selectOption({
      label: 'GitHub Games',
    });

    await test.step('Clear the active filters', async () => {
      const clearButton = page.getByRole('button', { name: 'Clear filters' });
      await expect(clearButton).toBeEnabled();
      await clearButton.click();
    });

    await test.step('Verify controls and results return to their defaults', async () => {
      await expect(page.getByRole('checkbox', { name: 'Action' })).not.toBeChecked();
      await expect(page.getByRole('combobox', { name: 'Publisher' })).toHaveValue('');
      await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(21);
      await expect(page.getByTestId('game-filter-summary')).toHaveText('21 of 21 games shown.');
      await expect(page.getByRole('button', { name: 'Clear filters' })).toBeDisabled();
    });
  });

  test('announces and displays an empty filtered result', async ({ page }) => {
    await page.getByRole('combobox', { name: 'Publisher' }).evaluate((select) => {
      if (!(select instanceof HTMLSelectElement)) {
        throw new Error('Expected the publisher filter to be a select element.');
      }

      const unavailablePublisher = document.createElement('option');
      unavailablePublisher.value = '99999';
      unavailablePublisher.textContent = 'Unavailable publisher';
      select.append(unavailablePublisher);
      select.value = unavailablePublisher.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await expect(page.getByTestId('games-grid')).toBeHidden();
    await expect(page.getByTestId('filter-empty-state')).toHaveText(
      'No games match the selected filters.',
    );
    await expect(page.getByTestId('game-filter-summary')).toHaveText('0 of 21 games shown.');
  });

  test('supports keyboard operation for category and publisher controls', async ({ page }) => {
    await test.step('Toggle a category with the keyboard', async () => {
      const strategyFilter = page.getByRole('checkbox', { name: 'Strategy' });
      await strategyFilter.focus();
      await expect(strategyFilter).toBeFocused();
      await strategyFilter.press('Space');
      await expect(strategyFilter).toBeChecked();
    });

    await test.step('Choose a publisher with the keyboard', async () => {
      const publisherFilter = page.getByRole('combobox', { name: 'Publisher' });
      await publisherFilter.focus();
      await expect(publisherFilter).toBeFocused();
      await publisherFilter.press('ArrowDown');
      await publisherFilter.press('Enter');
      await expect(publisherFilter.locator('option:checked')).toHaveText('CodeForge Studios');
      await expect(page.getByTestId('game-filter-summary')).toHaveText('1 of 21 games shown.');
    });
  });
});
