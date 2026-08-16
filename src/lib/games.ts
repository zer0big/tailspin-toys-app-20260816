import { and, asc, eq, inArray } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Category, Game, Publisher } from '../types/game';

export interface GameFilters {
    categoryIds?: number[];
    publisherId?: number;
}

export interface GameFilterOptions {
    categories: Category[];
    publishers: Publisher[];
}

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

/**
 * Lists the complete catalog for a statically generated page.
 *
 * @param db Injectable database client; pages use the local client and tests use an isolated in-memory client.
 * @returns Every game with its category and publisher, ordered alphabetically by title.
 */
export async function getAllGames(db: Database): Promise<Game[]> {
    const rows = await baseGamesQuery(db).orderBy(asc(games.title));
    return rows.map(mapGame);
}

/**
 * Lists games matching catalog filter selections.
 *
 * Multiple category identifiers use OR semantics. When a publisher is also
 * selected, it is combined with the category selection using AND semantics.
 *
 * @param db Injectable database client; pages use the local client and tests use an isolated in-memory client.
 * @param filters Category and publisher identifiers to match; omitted or empty values do not restrict results.
 * @returns Matching games with their relations, ordered alphabetically by title.
 */
export async function getFilteredGames(
    db: Database,
    filters: GameFilters,
): Promise<Game[]> {
    const conditions: SQL[] = [];

    if (filters.categoryIds && filters.categoryIds.length > 0) {
        conditions.push(inArray(games.categoryId, filters.categoryIds));
    }

    if (filters.publisherId !== undefined) {
        conditions.push(eq(games.publisherId, filters.publisherId));
    }

    const query = baseGamesQuery(db);
    const rows = conditions.length > 0
        ? await query.where(and(...conditions)).orderBy(asc(games.title))
        : await query.orderBy(asc(games.title));

    return rows.map(mapGame);
}

/**
 * Lists the available category and publisher choices for catalog filters.
 *
 * @param db Injectable database client; pages use the local client and tests use an isolated in-memory client.
 * @returns Category and publisher summaries, each ordered alphabetically by name.
 */
export async function getGameFilterOptions(db: Database): Promise<GameFilterOptions> {
    const [categoryRows, publisherRows] = await Promise.all([
        db
            .select({ id: categories.id, name: categories.name })
            .from(categories)
            .orderBy(asc(categories.name)),
        db
            .select({ id: publishers.id, name: publishers.name })
            .from(publishers)
            .orderBy(asc(publishers.name)),
    ]);

    return {
        categories: categoryRows,
        publishers: publisherRows,
    };
}

/**
 * Lists identifiers used to generate all static game detail routes.
 *
 * @param db Injectable database client; pages use the local client and tests use an isolated in-memory client.
 * @returns Every game identifier ordered by game title.
 */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/**
 * Finds a game for a statically generated detail page.
 *
 * @param db Injectable database client; pages use the local client and tests use an isolated in-memory client.
 * @param id Numeric game identifier from the route.
 * @returns The matching game with its relations, or `null` when no game exists.
 */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}
