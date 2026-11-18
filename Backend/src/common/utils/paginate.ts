import { FindAndCountOptions, Model, ModelStatic, Order } from 'sequelize';
import { PaginationQueryDto } from '../dto/pagination-query.dto';

export interface Paginated<T> {
  items: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

/**
 * Offset pagination with a whitelist of sortable columns (prevents ORDER BY injection).
 */
export async function paginate<M extends Model>(
  model: ModelStatic<M>,
  query: PaginationQueryDto,
  options: Omit<FindAndCountOptions, 'limit' | 'offset'> = {},
  sortable: string[] = ['id'],
  defaultOrder: Order = [['id', 'DESC']],
): Promise<Paginated<M>> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const order: Order =
    query.sortBy && sortable.includes(query.sortBy)
      ? [[query.sortBy, (query.sortDir || 'ASC').toUpperCase()]]
      : defaultOrder;

  const { rows, count } = await model.findAndCountAll({
    ...options,
    order,
    limit,
    offset: (page - 1) * limit,
    distinct: true,
  });

  return { items: rows, meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) } };
}
