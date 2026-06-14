import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { 
  useAdminMe, 
  useGetStatsOverview, 
  useGetManagers,
  useCreateManager,
  useDeleteManager,
  useGetTrainings,
  getGetManagersQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  BarChart3, Users, PlaySquare, Settings, LogOut, ArrowLeft, 
  Plus, Trash2, ChevronRight, TrendingUp, AlertTriangle, Eye
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

export default function AdminPanel() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");

  // Auth check
  const { data: meData, isLoading: isMeLoading, error: meError } = useAdminMe({
    query: { retry: false }
  });

  useEffect(() => {
    if (!isMeLoading && (!meData?.authenticated || meError)) {
      setLocation("/admin/login");
    }
  }, [meData, isMeLoading, meError, setLocation]);

  if (isMeLoading) return <div className="h-screen w-full flex items-center justify-center"><Spinner className="w-8 h-8 text-primary" /></div>;
  if (!meData?.authenticated) return null;

  return (
    <div className="h-screen w-full flex bg-background overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r bg-card flex flex-col shrink-0">
        <div className="h-16 flex items-center px-6 border-b shrink-0 bg-muted/10">
          <div className="h-8 w-8 bg-foreground rounded flex items-center justify-center text-background font-bold text-lg mr-3">R</div>
          <h1 className="font-bold text-lg tracking-tight">Админ-панель</h1>
        </div>
        
        <div className="flex-1 p-4 space-y-1 overflow-y-auto">
          <SidebarButton icon={BarChart3} label="Обзор" active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
          <SidebarButton icon={Users} label="Менеджеры" active={activeTab === "managers"} onClick={() => setActiveTab("managers")} />
          <SidebarButton icon={PlaySquare} label="Тренировки" active={activeTab === "trainings"} onClick={() => setActiveTab("trainings")} />
          <SidebarButton icon={TrendingUp} label="Статистика" active={activeTab === "stats"} onClick={() => setActiveTab("stats")} />
        </div>
        
        <div className="p-4 border-t bg-muted/10">
          <Link href="/">
            <Button variant="outline" className="w-full justify-start text-muted-foreground font-normal">
              <ArrowLeft className="w-4 h-4 mr-2" />
              В тренажёр
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#F8FAFC]">
        <div className="h-16 flex items-center px-8 border-b bg-card shrink-0 shadow-sm">
          <h2 className="text-lg font-semibold capitalize">
            {activeTab === 'overview' ? 'Обзор системы' : 
             activeTab === 'managers' ? 'Управление менеджерами' :
             activeTab === 'trainings' ? 'История тренировок' : 'Расширенная статистика'}
          </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            {activeTab === "overview" && <OverviewTab />}
            {activeTab === "managers" && <ManagersTab />}
            {activeTab === "trainings" && <TrainingsTab />}
            {activeTab === "stats" && <div className="text-center py-20 text-muted-foreground">Статистика в разработке</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarButton({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
        active 
          ? "bg-primary text-primary-foreground" 
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      }`}
    >
      <Icon className={`w-5 h-5 mr-3 ${active ? "opacity-100" : "opacity-70"}`} />
      {label}
    </button>
  );
}

// ---------------------------------------------------------
// OVERVIEW TAB
// ---------------------------------------------------------
function OverviewTab() {
  const { data: stats, isLoading } = useGetStatsOverview();

  if (isLoading) return <div className="py-12 flex justify-center"><Spinner className="w-8 h-8 text-primary" /></div>;
  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Всего менеджеров" value={stats.total_managers} icon={Users} />
        <StatCard title="Завершено тренировок" value={stats.completed_trainings} subValue={`Из ${stats.total_trainings} всего`} icon={PlaySquare} />
        <StatCard 
          title="Средний балл" 
          value={stats.avg_overall_score ? stats.avg_overall_score.toFixed(1) : "—"} 
          icon={TrendingUp} 
          highlight 
        />
        <StatCard 
          title="Отработка возражений" 
          value={stats.avg_objections_score ? stats.avg_objections_score.toFixed(1) : "—"} 
          icon={AlertTriangle} 
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Последние активности</CardTitle>
          <CardDescription>Недавние тренировки менеджеров</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Менеджер</TableHead>
                <TableHead>Сложность</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead className="text-right">Оценка</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.recent_trainings.slice(0, 5).map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.manager_name}</TableCell>
                  <TableCell>{t.difficulty === 'hard' ? 'Сложная' : t.difficulty === 'medium' ? 'Средняя' : 'Лёгкая'}</TableCell>
                  <TableCell>
                    {t.status === 'completed' ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 font-normal">Завершена</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-normal">Активна</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{format(new Date(t.started_at), "dd.MM.yyyy HH:mm")}</TableCell>
                  <TableCell className="text-right font-semibold">{t.overall_score ? `${t.overall_score}/10` : '—'}</TableCell>
                </TableRow>
              ))}
              {stats.recent_trainings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Нет данных</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, subValue, icon: Icon, highlight = false }: any) {
  return (
    <Card className={`border-border/60 ${highlight ? 'border-primary/20 bg-primary/5' : ''}`}>
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-foreground">{value}</span>
              {highlight && value !== "—" && <span className="text-sm text-primary font-medium">/ 10</span>}
            </div>
            {subValue && <p className="text-xs text-muted-foreground">{subValue}</p>}
          </div>
          <div className={`p-2 rounded-lg ${highlight ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------
// MANAGERS TAB
// ---------------------------------------------------------
function ManagersTab() {
  const { data: managers, isLoading } = useGetManagers();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  
  const createManager = useCreateManager({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetManagersQueryKey() });
        setIsAddOpen(false);
        setNewName("");
      }
    }
  });

  const deleteManager = useDeleteManager({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetManagersQueryKey() });
      }
    }
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    createManager.mutate({ data: { name: newName.trim() } });
  };

  if (isLoading) return <div className="py-12 flex justify-center"><Spinner className="w-8 h-8 text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-foreground">Список менеджеров</h3>
          <p className="text-sm text-muted-foreground">Управление сотрудниками, имеющими доступ к тренажёру.</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Добавить менеджера
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Имя</TableHead>
              <TableHead className="text-center">Всего тренировок</TableHead>
              <TableHead className="text-center">Завершено</TableHead>
              <TableHead className="text-center">Средний балл</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {managers?.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold">
                      {m.name.charAt(0)}
                    </div>
                    {m.name}
                  </div>
                </TableCell>
                <TableCell className="text-center">{m.training_count}</TableCell>
                <TableCell className="text-center">{m.completed_count}</TableCell>
                <TableCell className="text-center font-medium">
                  {m.avg_score ? (
                    <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">{m.avg_score.toFixed(1)}</Badge>
                  ) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" className="h-8">
                      <Eye className="w-4 h-4 mr-1" /> Профиль
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm(`Удалить менеджера ${m.name}?`)) {
                          deleteManager.mutate({ id: m.id });
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {managers?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Менеджеры не найдены. Добавьте первого сотрудника.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Добавить менеджера</DialogTitle>
            <DialogDescription>
              Введите имя сотрудника для создания профиля в тренажёре.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">ФИО менеджера</Label>
                <Input 
                  id="name" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)} 
                  placeholder="Иванов Иван" 
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Отмена</Button>
              <Button type="submit" disabled={createManager.isPending || !newName.trim()}>
                {createManager.isPending ? <Spinner className="w-4 h-4 mr-2" /> : null}
                Добавить
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------
// TRAININGS TAB
// ---------------------------------------------------------
function TrainingsTab() {
  const { data: trainings, isLoading } = useGetTrainings();

  if (isLoading) return <div className="py-12 flex justify-center"><Spinner className="w-8 h-8 text-primary" /></div>;

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Менеджер</TableHead>
            <TableHead>Сложность / Объект</TableHead>
            <TableHead>Дата начала</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead className="text-right">Оценка</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trainings?.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="text-muted-foreground font-mono text-xs">#{t.id}</TableCell>
              <TableCell className="font-medium">{t.manager_name}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Badge variant="outline" className="font-normal text-xs">{t.difficulty === 'hard' ? 'Сложная' : t.difficulty === 'medium' ? 'Средняя' : 'Лёгкая'}</Badge>
                  <Badge variant="secondary" className="font-normal text-xs">{t.property_type === 'house' ? 'Дом' : 'Квартира'}</Badge>
                </div>
              </TableCell>
              <TableCell className="text-sm">{format(new Date(t.started_at), "dd.MM.yyyy HH:mm")}</TableCell>
              <TableCell>
                {t.status === 'completed' ? (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 font-normal">Завершена</Badge>
                ) : (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-normal">Активна</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                {t.overall_score ? <span className="font-bold">{t.overall_score}/10</span> : <span className="text-muted-foreground">—</span>}
              </TableCell>
            </TableRow>
          ))}
          {trainings?.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                Тренировки пока не проводились.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
