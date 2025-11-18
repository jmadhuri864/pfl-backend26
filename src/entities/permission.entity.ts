import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import Model from './model.entity';
import { DocumentDefinition } from './documentdef.entity';
import { Levels } from './levels.entity';
import { User } from './user.entity';

@Entity('document_permissions')
export class DocumentPermission extends Model {

  
  @ManyToOne(() => DocumentDefinition, (docDef) => docDef.permissions)
  @JoinColumn({ name: 'document_definition_id' })
  documentDefinition: DocumentDefinition;

 
  @ManyToOne(() => User)
  employee: User;

  @Column({ default: false })
  canCreate: boolean;

  @Column({ default: false })
  canView: boolean;

  @Column({ default: false })
  canEdit: boolean;

  @Column({ default: false })
  canDelete: boolean;

  @Column({ default: false })
  canDownload: boolean;
}
