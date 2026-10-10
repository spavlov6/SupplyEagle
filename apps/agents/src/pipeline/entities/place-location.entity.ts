import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('place_locations')
export class PlaceLocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200, unique: true })
  query: string;

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision' })
  lon: number;

  @Column({ type: 'varchar', length: 80, nullable: true })
  country: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
