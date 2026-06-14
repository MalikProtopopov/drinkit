"use client";
// /profile — это та же главная, но с открытой шторкой профиля.
// Авторизация не требуется: гость видит карточку «добавь данные».
import { HomeWithProfile } from "../home/page";

export default function ProfilePage() {
  return <HomeWithProfile />;
}
