import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.category.findMany({
      where: { OR: [{ userId }, { isSystem: true }] },
      orderBy: { name: 'asc' },
    });
  }

  async create(userId: string, data: { name: string; icon?: string; color?: string; keywords?: string[] }) {
    return this.prisma.category.create({
      data: { ...data, userId, keywords: data.keywords || [] },
    });
  }

  async update(userId: string, id: string, data: { name?: string; icon?: string; color?: string; keywords?: string[] }) {
    const cat = await this.prisma.category.findFirst({ where: { id, userId } });
    if (!cat) throw new NotFoundException('Kategorie nicht gefunden');
    return this.prisma.category.update({ where: { id }, data });
  }

  async remove(userId: string, id: string) {
    const cat = await this.prisma.category.findFirst({ where: { id, userId, isSystem: false } });
    if (!cat) throw new NotFoundException('Kategorie nicht gefunden oder ist System-Kategorie');
    await this.prisma.transaction.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
    await this.prisma.category.delete({ where: { id } });
    return { message: 'Kategorie gelöscht' };
  }
}
