import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/user.entity.js';

@Entity('pipeline_schedules')
export class PipelineSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'int' })
  hour: number;

  @Column({ type: 'int' })
  minute: number;

  @Column({ type: 'varchar', length: 80 })
  timezone: string;

  @Column({ type: 'timestamptz', nullable: true })
  nextRunAt: Date | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
