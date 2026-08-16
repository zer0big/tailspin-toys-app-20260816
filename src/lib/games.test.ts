import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getFilteredGames,
    getGameFilterOptions,
    getGameById,
} from './games';

interface FilterFixtureIds {
    strategyId: number;
    puzzleId: number;
    simulationId: number;
    publisherZedId: number;
    publisherAlphaId: number;
}

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

async function seedFilterGames(db: Database): Promise<FilterFixtureIds> {
    const [strategy, puzzle, simulation] = await db
        .insert(categories)
        .values([
            { name: 'Strategy', description: 'Strategy games' },
            { name: 'Puzzle', description: 'Puzzle games' },
            { name: 'Simulation', description: 'Simulation games' },
        ])
        .returning({ id: categories.id });
    const [publisherZed, publisherAlpha] = await db
        .insert(publishers)
        .values([
            { name: 'Publisher Zed', description: 'Zed publisher' },
            { name: 'Publisher Alpha', description: 'Alpha publisher' },
        ])
        .returning({ id: publishers.id });

    await db.insert(games).values([
        {
            title: 'Delta Puzzle',
            description: 'Puzzle by Alpha',
            starRating: 4.1,
            categoryId: puzzle.id,
            publisherId: publisherAlpha.id,
        },
        {
            title: 'Alpha Strategy',
            description: 'Strategy by Zed',
            starRating: 4.2,
            categoryId: strategy.id,
            publisherId: publisherZed.id,
        },
        {
            title: 'Echo Simulation',
            description: 'Simulation by Zed',
            starRating: 4.3,
            categoryId: simulation.id,
            publisherId: publisherZed.id,
        },
        {
            title: 'Charlie Puzzle',
            description: 'Puzzle by Zed',
            starRating: 4.4,
            categoryId: puzzle.id,
            publisherId: publisherZed.id,
        },
        {
            title: 'Bravo Strategy',
            description: 'Strategy by Alpha',
            starRating: 4.5,
            categoryId: strategy.id,
            publisherId: publisherAlpha.id,
        },
    ]);

    return {
        strategyId: strategy.id,
        puzzleId: puzzle.id,
        simulationId: simulation.id,
        publisherZedId: publisherZed.id,
        publisherAlphaId: publisherAlpha.id,
    };
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });

    it('filters games by one category', async () => {
        const fixture = await seedFilterGames(db);

        const filtered = await getFilteredGames(db, {
            categoryIds: [fixture.strategyId],
        });

        expect(filtered).toHaveLength(2);
        expect(filtered.map((game) => game.title)).toEqual([
            'Alpha Strategy',
            'Bravo Strategy',
        ]);
    });

    it('uses OR semantics for multiple categories', async () => {
        const fixture = await seedFilterGames(db);

        const filtered = await getFilteredGames(db, {
            categoryIds: [fixture.strategyId, fixture.puzzleId],
        });

        expect(filtered).toHaveLength(4);
        expect(filtered.map((game) => game.title)).toEqual([
            'Alpha Strategy',
            'Bravo Strategy',
            'Charlie Puzzle',
            'Delta Puzzle',
        ]);
    });

    it('filters games by publisher', async () => {
        const fixture = await seedFilterGames(db);

        const filtered = await getFilteredGames(db, {
            publisherId: fixture.publisherZedId,
        });

        expect(filtered).toHaveLength(3);
        expect(filtered.map((game) => game.title)).toEqual([
            'Alpha Strategy',
            'Charlie Puzzle',
            'Echo Simulation',
        ]);
    });

    it('combines category and publisher filters with AND semantics', async () => {
        const fixture = await seedFilterGames(db);

        const filtered = await getFilteredGames(db, {
            categoryIds: [fixture.strategyId, fixture.puzzleId],
            publisherId: fixture.publisherAlphaId,
        });

        expect(filtered).toHaveLength(2);
        expect(filtered.map((game) => game.title)).toEqual([
            'Bravo Strategy',
            'Delta Puzzle',
        ]);
    });

    it('returns an empty list when no games match all filters', async () => {
        const fixture = await seedFilterGames(db);

        const filtered = await getFilteredGames(db, {
            categoryIds: [fixture.simulationId],
            publisherId: fixture.publisherAlphaId,
        });

        expect(filtered).toEqual([]);
    });

    it('returns filter options ordered by name', async () => {
        await seedFilterGames(db);

        const options = await getGameFilterOptions(db);

        expect(options.categories.map((category) => category.name)).toEqual([
            'Puzzle',
            'Simulation',
            'Strategy',
        ]);
        expect(options.publishers.map((publisher) => publisher.name)).toEqual([
            'Publisher Alpha',
            'Publisher Zed',
        ]);
    });
});
