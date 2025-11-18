import { Repository } from "typeorm";
import { Crop } from "../entities/crop.entity";

export class CropRepository extends Repository<Crop> {}