import { Repository } from "typeorm";
import { Item } from "../entities/dItem.entity";

export class DitemRepository extends Repository<Item> {
}