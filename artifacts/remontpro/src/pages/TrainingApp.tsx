import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  useGetTrainings, 
  useCreateTraining, 
  useGetTraining, 
  useSendMessage, 
  useFinishTraining,
  getGetTrainingsQueryKey,
  getGetTrainingQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle2, ChevronRight, LogOut, MessageSquare, Play, Send, AlertTriangle, ArrowRight, User } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

// Types derived from schema
type TrainingDetail = any; // Will rely on API types when fetched
type Manager = { id: number; name: string };

export default function TrainingApp() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [manager, setManager] = useState<Manager | null>(null);
  const [activeTrainingId, setActiveTrainingId] = useState<number | null>(null);
  
  // Modals state
  const [isNewTrainingModalOpen, setIsNewTrainingModalOpen] = useState(false);
  const [isFinishConfirmOpen, setIsFinishConfirmOpen] = useState(false);
  
  // Chat state
  const [messageInput, setMessageInput] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("remontpro_manager");
    if (stored) {
      setManager(JSON.parse(stored));
    } else {
      setLocation("/");
    }
  }, [setLocation]);

  const { data: trainings, isLoading: isTrainingsLoading } = useGetTrainings(
    { managerId: manager?.id },
    { query: { enabled: !!manager?.id } }
  );

  const { data: activeTraining, isLoading: isActiveTrainingLoading } = useGetTraining(
    activeTrainingId || 0,
    { query: { enabled: !!activeTrainingId } }
  );

  const createTraining = useCreateTraining({
    mutation: {
      onSuccess: (data) => {
        setIsNewTrainingModalOpen(false);
        setActiveTrainingId(data.id);
        queryClient.invalidateQueries({ queryKey: getGetTrainingsQueryKey({ managerId: manager?.id }) });
      },
    }
  });

  const sendMessage = useSendMessage({
    mutation: {
      onSuccess: () => {
        setMessageInput("");
        queryClient.invalidateQueries({ queryKey: getGetTrainingQueryKey(activeTrainingId!) });
      }
    }
  });

  const finishTraining = useFinishTraining({
    mutation: {
      onSuccess: () => {
        setIsFinishConfirmOpen(false);
        queryClient.invalidateQueries({ queryKey: getGetTrainingQueryKey(activeTrainingId!) });
        queryClient.invalidateQueries({ queryKey: getGetTrainingsQueryKey({ managerId: manager?.id }) });
      }
    }
  });

  const handleCreateTraining = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createTraining.mutate({
      data: {
        manager_id: manager!.id,
        difficulty: formData.get("difficulty") as string,
        property_type: formData.get("property_type") as string,
      }
    });
  };

  const handleSendMessage = () => {
    if (!messageInput.trim() || !activeTrainingId || sendMessage.isPending) return;
    sendMessage.mutate({
      id: activeTrainingId,
      data: { content: messageInput.trim() }
    });
  };

  if (!manager) return null;

  const difficultyMap: Record<string, { label: string, color: string }> = {
    easy: { label: "Лёгкая", color: "bg-green-100 text-green-800 border-green-200" },
    medium: { label: "Средняя", color: "bg-blue-100 text-blue-800 border-blue-200" },
    hard: { label: "Сложная", color: "bg-orange-100 text-orange-800 border-orange-200" }
  };

  return (
    <div className="h-screen w-full flex overflow-hidden bg-background">
      {/* LEFT COLUMN: Training List */}
      <div className="w-[22%] min-w-[280px] max-w-[320px] flex flex-col border-r bg-card shadow-sm z-10">
        <div className="p-4 border-b bg-muted/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
              {manager.name.charAt(0)}
            </div>
            <div className="flex-1 truncate">
              <h2 className="font-semibold text-sm truncate" title={manager.name}>{manager.name}</h2>
              <p className="text-xs text-muted-foreground">Менеджер по продажам</p>
            </div>
            <Button variant="ghost" size="icon" className="text-muted-foreground shrink-0" onClick={() => setLocation("/")} title="Сменить менеджера">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
          <Button 
            className="w-full font-medium" 
            onClick={() => setIsNewTrainingModalOpen(true)}
            data-testid="btn-new-training"
          >
            <Play className="w-4 h-4 mr-2" />
            Новая тренировка
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">История тренировок</h3>
          </div>
          
          {isTrainingsLoading ? (
            <div className="flex justify-center p-4"><Spinner className="text-primary w-6 h-6" /></div>
          ) : trainings?.length === 0 ? (
            <div className="text-center p-4 text-sm text-muted-foreground bg-muted/30 rounded-md border border-dashed">
              Нет сохраненных тренировок
            </div>
          ) : (
            <div className="space-y-2">
              {trainings?.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTrainingId(t.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    activeTrainingId === t.id 
                      ? "bg-primary/5 border-primary shadow-sm" 
                      : "bg-card border-border hover:border-primary/30 hover:bg-muted/30"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(t.started_at), "d MMM, HH:mm", { locale: ru })}
                    </span>
                    {t.status === 'active' ? (
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-blue-50 text-blue-700 border-blue-200">Активна</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-green-50 text-green-700 border-green-200">Завершена</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={`text-[10px] font-normal px-1.5 ${difficultyMap[t.difficulty]?.color || ''}`}>
                      {difficultyMap[t.difficulty]?.label || t.difficulty}
                    </Badge>
                    {t.overall_score && (
                      <span className="text-sm font-semibold flex items-center text-foreground">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-green-600" />
                        {t.overall_score}/10
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-muted/10">
          <Button variant="outline" className="w-full text-xs" onClick={() => setLocation("/admin/login")}>
            Перейти в админку
          </Button>
        </div>
      </div>

      {/* CENTER COLUMN: Chat Interface */}
      <div className="w-[53%] flex flex-col flex-1 bg-[#F8FAFC]">
        {activeTrainingId ? (
          isActiveTrainingLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Spinner className="w-8 h-8 text-primary" />
            </div>
          ) : activeTraining ? (
            <>
              {/* Chat Header */}
              <div className="h-14 border-b bg-card flex items-center justify-between px-6 shadow-sm z-10 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">Тренировка #{activeTraining.id}</span>
                    <Badge variant="outline" className={`text-xs font-normal px-2 ${difficultyMap[activeTraining.difficulty]?.color || ''}`}>
                      {difficultyMap[activeTraining.difficulty]?.label || activeTraining.difficulty}
                    </Badge>
                    <Badge variant="secondary" className="text-xs font-normal capitalize">
                      {activeTraining.property_type === 'house' ? 'Дом' : activeTraining.property_type === 'apartment' ? 'Квартира' : activeTraining.property_type}
                    </Badge>
                  </div>
                </div>
                {activeTraining.status === 'active' && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-xs font-medium text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setIsFinishConfirmOpen(true)}
                    disabled={sendMessage.isPending || finishTraining.isPending}
                  >
                    Завершить тренировку
                  </Button>
                )}
              </div>

              {/* Chat Messages */}
              <ScrollArea className="flex-1 p-6">
                <div className="space-y-6 max-w-2xl mx-auto pb-6">
                  {activeTraining.messages?.map((msg: any) => (
                    <div 
                      key={msg.id} 
                      className={`flex ${msg.role === 'manager' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`flex gap-3 max-w-[85%] ${msg.role === 'manager' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center mt-auto ${
                          msg.role === 'manager' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                        }`}>
                          {msg.role === 'manager' ? manager.name.charAt(0) : <User className="w-4 h-4" />}
                        </div>
                        <div className={`p-4 rounded-2xl ${
                          msg.role === 'manager' 
                            ? 'bg-primary text-primary-foreground rounded-br-sm shadow-md' 
                            : 'bg-card border shadow-sm rounded-bl-sm text-card-foreground'
                        }`}>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          <span className={`text-[10px] mt-2 block ${msg.role === 'manager' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                            {format(new Date(msg.created_at), "HH:mm")}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {sendMessage.isPending && (
                    <div className="flex justify-start">
                      <div className="flex gap-3 max-w-[85%]">
                        <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center mt-auto bg-secondary text-secondary-foreground">
                          <User className="w-4 h-4" />
                        </div>
                        <div className="p-4 rounded-2xl bg-card border shadow-sm rounded-bl-sm text-card-foreground flex items-center h-[52px]">
                          <div className="flex space-x-1.5 items-center opacity-60">
                            <div className="w-2 h-2 bg-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                          <span className="text-xs text-muted-foreground ml-3 italic">Клиент печатает...</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTraining.status === 'completed' && activeTraining.final_report && (
                    <div className="mt-8 border rounded-xl overflow-hidden shadow-sm bg-card">
                      <div className="bg-primary text-primary-foreground p-4 text-center">
                        <h3 className="text-lg font-bold">Тренировка завершена</h3>
                        <div className="text-4xl font-black mt-2 mb-1">{activeTraining.final_report.overall_score}<span className="text-2xl text-primary-foreground/70">/10</span></div>
                        <p className="text-sm opacity-90">Итоговый балл</p>
                      </div>
                      <div className="p-6 space-y-6">
                        <div>
                          <h4 className="text-sm font-bold text-foreground mb-3 uppercase tracking-wider flex items-center">
                            <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" /> 
                            Сильные стороны
                          </h4>
                          <ul className="space-y-2">
                            {activeTraining.final_report.strengths.map((s: string, i: number) => (
                              <li key={i} className="text-sm flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                                <span>{s}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        {activeTraining.final_report.problems?.length > 0 && (
                          <div>
                            <h4 className="text-sm font-bold text-foreground mb-3 uppercase tracking-wider flex items-center">
                              <AlertTriangle className="w-4 h-4 mr-2 text-orange-500" /> 
                              Зоны роста
                            </h4>
                            <ul className="space-y-2">
                              {activeTraining.final_report.problems.map((p: string, i: number) => (
                                <li key={i} className="text-sm flex items-start gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                                  <span>{p}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Chat Input */}
              {activeTraining.status === 'active' && (
                <div className="p-4 bg-card border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
                  <div className="max-w-2xl mx-auto relative flex items-end gap-2">
                    <Textarea 
                      placeholder="Введите ваш ответ клиенту..." 
                      className="resize-none min-h-[60px] max-h-[200px] bg-muted/50 border-border focus-visible:ring-primary/50 text-sm py-3"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      disabled={sendMessage.isPending || finishTraining.isPending}
                    />
                    <Button 
                      className="h-[60px] w-[60px] shrink-0 rounded-xl" 
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim() || sendMessage.isPending || finishTraining.isPending}
                    >
                      {sendMessage.isPending ? <Spinner className="w-5 h-5" /> : <Send className="w-5 h-5" />}
                    </Button>
                  </div>
                  <div className="max-w-2xl mx-auto mt-2 text-[10px] text-muted-foreground text-center">
                    Нажмите Enter для отправки, Shift+Enter для переноса строки
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-muted-foreground">
              Ошибка загрузки тренировки
            </div>
          )
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <MessageSquare className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-3">Готовы к тренировке?</h2>
            <p className="text-muted-foreground max-w-md mb-8">
              Выберите прошлую тренировку из списка слева или начните новую, чтобы практиковать навыки продаж с AI-клиентом.
            </p>
            <Button size="lg" onClick={() => setIsNewTrainingModalOpen(true)}>
              <Play className="w-5 h-5 mr-2" />
              Начать новую тренировку
            </Button>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Coach Feedback */}
      <div className="w-[25%] min-w-[300px] flex flex-col border-l bg-card shadow-sm z-10">
        <div className="h-14 border-b flex items-center px-4 shrink-0 bg-muted/10">
          <h2 className="font-semibold text-sm flex items-center gap-2 text-foreground">
            <AlertCircle className="w-4 h-4 text-primary" />
            Рекомендации AI-тренера
          </h2>
        </div>
        
        <ScrollArea className="flex-1 p-4">
          {!activeTrainingId ? (
            <div className="text-center py-10 px-4">
              <p className="text-sm text-muted-foreground italic">
                Откройте тренировку, чтобы увидеть рекомендации.
              </p>
            </div>
          ) : !activeTraining?.feedbacks?.length ? (
            <div className="text-center py-10 px-4 border-2 border-dashed rounded-lg bg-muted/20">
              <p className="text-sm text-muted-foreground">
                После вашего ответа клиенту здесь появятся рекомендации AI-тренера с анализом ваших сильных сторон и ошибок.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {[...activeTraining.feedbacks].reverse().map((feedback: any) => {
                const f = feedback.feedback_json;
                return (
                  <Card key={feedback.id} className="overflow-hidden border-border/60 shadow-sm">
                    <div className="bg-muted/40 p-2.5 border-b text-xs font-medium text-muted-foreground flex justify-between items-center">
                      <span>Анализ ответа</span>
                      <span>{format(new Date(feedback.created_at), "HH:mm")}</span>
                    </div>
                    <CardContent className="p-4 space-y-4">
                      {f.strengths && (
                        <div>
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-chart-2 mb-1.5 flex items-center">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Сильные стороны
                          </h4>
                          <p className="text-sm text-foreground/90">{f.strengths}</p>
                        </div>
                      )}
                      
                      {f.mistakes && (
                        <div>
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-chart-3 mb-1.5 flex items-center">
                            <AlertTriangle className="w-3 h-3 mr-1" /> Ошибки
                          </h4>
                          <p className="text-sm text-foreground/90">{f.mistakes}</p>
                        </div>
                      )}
                      
                      {f.recommendation && (
                        <div>
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-primary mb-1.5 flex items-center">
                            <ArrowRight className="w-3 h-3 mr-1" /> Рекомендация
                          </h4>
                          <p className="text-sm text-foreground/90">{f.recommendation}</p>
                        </div>
                      )}
                      
                      {f.example_phrase && (
                        <div className="bg-primary/5 border-l-2 border-primary p-3 rounded-r-md mt-2">
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">Пример фразы</h4>
                          <p className="text-sm italic text-foreground/80">"{f.example_phrase}"</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Modals */}
      <Dialog
        open={isNewTrainingModalOpen}
        onOpenChange={(open) => {
          if (createTraining.isPending) return;
          if (!open) createTraining.reset();
          setIsNewTrainingModalOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Новая тренировка</DialogTitle>
            <DialogDescription>
              Выберите параметры для симуляции диалога с клиентом.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTraining}>
            <div className="grid gap-6 py-4">
              <div className="space-y-3">
                <Label>Сложность клиента</Label>
                <RadioGroup defaultValue="medium" name="difficulty" className="flex gap-4">
                  <div className="flex items-center space-x-2 border rounded-md p-3 flex-1 bg-muted/20 hover:bg-muted/50 transition-colors cursor-pointer">
                    <RadioGroupItem value="easy" id="d-easy" />
                    <Label htmlFor="d-easy" className="cursor-pointer font-normal text-sm w-full">Лёгкая</Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-md p-3 flex-1 bg-muted/20 hover:bg-muted/50 transition-colors cursor-pointer">
                    <RadioGroupItem value="medium" id="d-medium" />
                    <Label htmlFor="d-medium" className="cursor-pointer font-normal text-sm w-full">Средняя</Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-md p-3 flex-1 bg-muted/20 hover:bg-muted/50 transition-colors cursor-pointer">
                    <RadioGroupItem value="hard" id="d-hard" />
                    <Label htmlFor="d-hard" className="cursor-pointer font-normal text-sm w-full">Сложная</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-3">
                <Label>Тип недвижимости</Label>
                <Select name="property_type" defaultValue="random">
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите тип" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="random">Случайный выбор</SelectItem>
                    <SelectItem value="apartment">Квартира</SelectItem>
                    <SelectItem value="house">Дом</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {createTraining.isPending && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-800">
                  <Spinner className="w-4 h-4 shrink-0 text-blue-600" />
                  <span className="text-sm font-medium">Создаём AI-клиента…</span>
                </div>
              )}

              {createTraining.isError && (
                <div className="flex items-start gap-3 p-3 bg-destructive/10 border border-destructive/30 rounded-md text-destructive">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span className="text-sm">
                    {createTraining.error instanceof Error
                      ? createTraining.error.message
                      : "Не удалось создать тренировку. Попробуйте ещё раз."}
                  </span>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => { createTraining.reset(); setIsNewTrainingModalOpen(false); }}
                disabled={createTraining.isPending}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={createTraining.isPending}>
                {createTraining.isPending ? (
                  <>
                    <Spinner className="w-4 h-4 mr-2" />
                    Создаём…
                  </>
                ) : "Начать тренировку"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isFinishConfirmOpen} onOpenChange={setIsFinishConfirmOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Завершить тренировку?</DialogTitle>
            <DialogDescription>
              Диалог будет остановлен, и вы получите итоговую оценку по всем критериям продаж. Это действие нельзя отменить.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsFinishConfirmOpen(false)} disabled={finishTraining.isPending}>
              Продолжить диалог
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => finishTraining.mutate({ id: activeTrainingId! })}
              disabled={finishTraining.isPending}
            >
              {finishTraining.isPending && <Spinner className="w-4 h-4 mr-2 text-white" />}
              Завершить и получить оценку
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
