import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Exam } from '../exams/entities/exam.entities';
import { StudentsModule } from '../students/students.module';
import { TransportModule } from '../transport/transport.module';
import { CashbookController } from './controllers/cashbook.controller';
import { FeesController } from './controllers/fees.controller';
import {
  CashbookEntry,
  CashbookHead,
  FeeConcession,
  FeeHead,
  FeeInstallment,
  FeePayment,
  FeePaymentItem,
  FeeStructure,
} from './entities/fee.entities';
import { CashbookService } from './services/cashbook.service';
import { FeeCollectionService } from './services/fee-collection.service';
import { FeeLedgerService } from './services/fee-ledger.service';
import { FeeSetupService } from './services/fee-setup.service';

@Module({
  imports: [
    SequelizeModule.forFeature([Exam, FeeHead, FeeInstallment, FeeStructure, FeeConcession, FeePayment, FeePaymentItem, CashbookHead, CashbookEntry]),
    StudentsModule,
    TransportModule,
  ],
  controllers: [FeesController, CashbookController],
  providers: [FeeSetupService, FeeLedgerService, FeeCollectionService, CashbookService],
  exports: [FeeLedgerService, FeeCollectionService, SequelizeModule],
})
export class FeesModule {}
