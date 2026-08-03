import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PlanningController } from './planning.controller';
import { PlanningService } from './planning.service';

describe('PlanningController', () => {
  let controller: PlanningController;
  const service = {
    upload: jest.fn(),
    getPlanning: jest.fn(),
    getSchedule: jest.fn(),
    getConfig: jest.fn(),
    updateConfig: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlanningController],
      providers: [{ provide: PlanningService, useValue: service }],
    }).compile();
    controller = module.get<PlanningController>(PlanningController);
    jest.clearAllMocks();
  });

  it('rejects a missing file on upload', async () => {
    service.upload.mockRejectedValue(new BadRequestException('file is required'));
    await expect(controller.upload(undefined as never)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('delegates getPlanning to the service', async () => {
    service.getPlanning.mockResolvedValue({ startDate: null, people: [], warnings: [] });
    await expect(controller.getPlanning()).resolves.toEqual({ startDate: null, people: [], warnings: [] });
    expect(service.getPlanning).toHaveBeenCalled();
  });

  it('delegates getSchedule to the service', async () => {
    service.getSchedule.mockResolvedValue({ month: '2026-08', days: {} });
    await expect(controller.getSchedule('2026-08')).resolves.toEqual({ month: '2026-08', days: {} });
    expect(service.getSchedule).toHaveBeenCalledWith('2026-08');
  });

  it('delegates config get/put to the service', async () => {
    service.getConfig.mockResolvedValue({ startDate: null, defaultName: null });
    await expect(controller.getConfig()).resolves.toEqual({ startDate: null, defaultName: null });
    service.updateConfig.mockResolvedValue({ startDate: '2026-07-27', defaultName: null });
    await expect(controller.updateConfig({ startDate: '2026-07-27' })).resolves.toEqual({
      startDate: '2026-07-27',
      defaultName: null,
    });
    expect(service.updateConfig).toHaveBeenCalledWith({ startDate: '2026-07-27' });
  });
});
