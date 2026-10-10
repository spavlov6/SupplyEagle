import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('pipeline_schedules')
export class PipelineSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'uuid' })
  userId: string;

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
