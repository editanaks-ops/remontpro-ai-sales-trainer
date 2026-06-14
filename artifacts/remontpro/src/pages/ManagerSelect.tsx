import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetManagers } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Users, TrendingUp, ChevronRight, UserCircle } from "lucide-react";

export default function ManagerSelect() {
  const { data: managers, isLoading, error } = useGetManagers();
  const [, setLocation] = useLocation();

  const handleSelectManager = (manager: { id: number; name: string }) => {
    localStorage.setItem("remontpro_manager", JSON.stringify(manager));
    setLocation("/app");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card py-4 px-6 shadow-sm flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-primary rounded flex items-center justify-center text-primary-foreground font-bold text-lg">
            R
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            РемонтPRO
            <span className="text-muted-foreground ml-2 font-normal text-sm border-l pl-2 border-border">
              AI-тренер отдела продаж
            </span>
          </h1>
        </div>
        <Link href="/admin/login" className="text-sm text-muted-foreground hover:text-primary font-medium transition-colors">
          Перейти в админку →
        </Link>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3 tracking-tight">Выберите менеджера</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Для начала тренировки выберите свой профиль из списка ниже. Все результаты будут сохранены в вашей статистике.
          </p>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Spinner className="w-8 h-8 mb-4 text-primary" />
            <p>Загрузка менеджеров...</p>
          </div>
        ) : error ? (
          <div className="text-center text-destructive py-10 bg-destructive/10 rounded-lg max-w-md mx-auto">
            <p className="font-medium">Ошибка загрузки списка менеджеров.</p>
            <p className="text-sm mt-1 opacity-80">Пожалуйста, попробуйте обновить страницу.</p>
          </div>
        ) : managers?.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-border rounded-xl bg-card">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">Нет менеджеров</h3>
            <p className="text-muted-foreground text-sm">В системе пока не зарегистрировано ни одного менеджера.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {managers?.map((manager) => (
              <Card key={manager.id} className="hover:shadow-md transition-shadow duration-200 border-border/50 group flex flex-col">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-medium">
                      {manager.name.charAt(0)}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{manager.name}</CardTitle>
                      <CardDescription>Менеджер по продажам</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 pb-4">
                  <div className="grid grid-cols-2 gap-4 bg-muted/50 p-3 rounded-md text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1 text-xs uppercase font-medium tracking-wider">Тренировки</p>
                      <p className="font-semibold text-foreground flex items-center gap-1.5">
                        {manager.completed_count} <span className="text-muted-foreground font-normal">/ {manager.training_count}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1 text-xs uppercase font-medium tracking-wider">Средний балл</p>
                      <p className="font-semibold text-foreground flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-primary" />
                        {manager.avg_score ? manager.avg_score.toFixed(1) : "—"} / 10
                      </p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  <Button 
                    className="w-full group-hover:bg-primary/90 transition-colors" 
                    onClick={() => handleSelectManager({ id: manager.id, name: manager.name })}
                    data-testid={`btn-select-manager-${manager.id}`}
                  >
                    Войти в тренажёр
                    <ChevronRight className="w-4 h-4 ml-1 opacity-70" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
