import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAdminLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");

  const adminLogin = useAdminLogin({
    mutation: {
      onSuccess: (data) => {
        if (data.success) {
          setLocation("/admin");
        } else {
          toast({
            variant: "destructive",
            title: "Ошибка входа",
            description: data.message || "Неверный логин или пароль",
          });
        }
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: "Произошла ошибка при попытке входа",
        });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!login || !password) return;
    adminLogin.mutate({
      data: { login, password }
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="p-6">
        <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Вернуться в тренажёр
        </Link>
      </div>
      
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg border-border/50">
          <CardHeader className="space-y-2 text-center pb-8 pt-8">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
              <ShieldAlert className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Панель управления</CardTitle>
            <CardDescription className="text-sm">
              Войдите для доступа к статистике и управлению менеджерами
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login">Логин</Label>
                <Input 
                  id="login" 
                  type="text" 
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="admin"
                  required
                  className="bg-muted/50"
                  disabled={adminLogin.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Пароль</Label>
                <Input 
                  id="password" 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-muted/50"
                  disabled={adminLogin.isPending}
                />
              </div>
              <Button type="submit" className="w-full mt-6" disabled={adminLogin.isPending || !login || !password}>
                {adminLogin.isPending ? <Spinner className="w-5 h-5 mr-2" /> : null}
                Войти в систему
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
