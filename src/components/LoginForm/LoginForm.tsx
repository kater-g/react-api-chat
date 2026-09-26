import {
  useState,
  useMemo,
  type SyntheticEvent,
  type ChangeEvent,
} from "react";
import { apiConfig } from "@/config/api";
import styles from "./LoginForm.module.css";

export type FieldName = "idInstance" | "apiTokenInstance";

export type FormValues = {
  idInstance: string;
  apiTokenInstance: string;
};

type FormErrors = Partial<Record<FieldName, string>>;

interface Props {
  onLogin: (credentials: {
    idInstance: string;
    apiTokenInstance: string;
    apiUrl: string;
  }) => Promise<void> | void;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * Ограничения максимальной длины для полей ввода авторизации.
 */
const LIMITS = {
  idInstance: 20,
  apiTokenInstance: 100,
};

/**
 * Валидирует введенные учетные данные инстанса перед отправкой.
 */
const validate = (values: FormValues): FormErrors => {
  const errors: FormErrors = {};
  const idInstance = values.idInstance.trim();
  const apiTokenInstance = values.apiTokenInstance.trim();

  // Валидирует idInstance на наличие символов, не являющихся цифрами
  if (!idInstance) {
    errors.idInstance = "Введите idInstance";
  } else if (!/^\d+$/.test(idInstance)) {
    errors.idInstance = "idInstance должен содержать только цифры";
  } else if (idInstance.length > LIMITS.idInstance) {
    errors.idInstance = `idInstance не должен превышать ${LIMITS.idInstance} цифр`;
  }

  // Валидирует токен на длину и отсутствие пробелов
  if (!apiTokenInstance) {
    errors.apiTokenInstance = "Введите apiTokenInstance";
  } else if (/\s/.test(apiTokenInstance)) {
    errors.apiTokenInstance = "Токен не должен содержать пробелы";
  } else if (
    apiTokenInstance.length < 20 ||
    apiTokenInstance.length > LIMITS.apiTokenInstance
  ) {
    errors.apiTokenInstance = `Токен должен быть длиной от 20 до ${LIMITS.apiTokenInstance} символов`;
  }

  return errors;
};

/**
 * Форма авторизации по учетным данным GREEN-API (idInstance и apiTokenInstance).
 */
export const LoginForm = ({ onLogin, isLoading = false, error }: Props) => {
  const [values, setValues] = useState<FormValues>({
    idInstance: "",
    apiTokenInstance: "",
  });
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>(
    {},
  );
  const [showToken, setShowToken] = useState(false);

  // Вычисляет текущие ошибки валидации при изменении значений полей
  const errors = useMemo(() => validate(values), [values]);

  // Определяет доступность кнопки входа при корректно заполненных полях
  const isFormValid = useMemo(() => {
    const hasValues =
      values.idInstance.trim().length > 0 &&
      values.apiTokenInstance.trim().length > 0;
    return hasValues && Object.keys(errors).length === 0;
  }, [values, errors]);

  // Обновляет значение конкретного поля формы
  const handleChange =
    (field: FieldName) => (e: ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
    };

  // Помечает поле как посещенное для показа валидационных сообщений
  const handleBlur = (field: FieldName) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  // Обрабатывает отправку формы с валидацией всех полей
  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    setTouched({ idInstance: true, apiTokenInstance: true });

    if (!isFormValid || isLoading) {
      return;
    }

    void onLogin({
      idInstance: values.idInstance.trim(),
      apiTokenInstance: values.apiTokenInstance.trim(),
      apiUrl: apiConfig.apiUrl,
    });
  };

  // Возвращает текст ошибки только если поле уже было затронуто пользователем
  const visibleError = (field: FieldName) =>
    touched[field] ? errors[field] : undefined;

  return (
    <main className={styles["login-form"]}>
      <form
        className={styles["login-form__form"]}
        onSubmit={handleSubmit}
        noValidate
      >
        <header className={styles["login-form__header"]}>
          <h1 className={styles["login-form__title"]}>GREEN-API Chat</h1>
          <p className={styles["login-form__subtitle"]}>
            Введите учетные данные инстанса для входа
          </p>
        </header>

        <div className={styles["login-form__field"]}>
          <label htmlFor="idInstance" className={styles["login-form__label"]}>
            idInstance
          </label>
          <input
            id="idInstance"
            type="text"
            className={`${styles["login-form__input"]} ${
              visibleError("idInstance")
                ? styles["login-form__input--error"]
                : ""
            }`}
            placeholder="Введите idInstance из личного кабинета"
            maxLength={LIMITS.idInstance}
            value={values.idInstance}
            onChange={handleChange("idInstance")}
            onBlur={() => handleBlur("idInstance")}
            inputMode="numeric"
            autoComplete="username"
            disabled={isLoading}
            aria-invalid={Boolean(visibleError("idInstance"))}
            aria-describedby={
              visibleError("idInstance") ? "idInstance-error" : undefined
            }
          />
          {visibleError("idInstance") && (
            <p
              className={styles["login-form__error"]}
              id="idInstance-error"
              role="alert"
            >
              {visibleError("idInstance")}
            </p>
          )}
        </div>

        <div className={styles["login-form__field"]}>
          <label
            htmlFor="apiTokenInstance"
            className={styles["login-form__label"]}
          >
            apiTokenInstance
          </label>
          <div className={styles["login-form__input-wrap"]}>
            <input
              id="apiTokenInstance"
              type={showToken ? "text" : "password"}
              className={`${styles["login-form__input"]} ${
                visibleError("apiTokenInstance")
                  ? styles["login-form__input--error"]
                  : ""
              }`}
              placeholder="Вставьте токен из личного кабинета"
              maxLength={LIMITS.apiTokenInstance}
              value={values.apiTokenInstance}
              onChange={handleChange("apiTokenInstance")}
              onBlur={() => handleBlur("apiTokenInstance")}
              autoComplete="current-password"
              disabled={isLoading}
              aria-invalid={Boolean(visibleError("apiTokenInstance"))}
              aria-describedby={
                visibleError("apiTokenInstance")
                  ? "apiTokenInstance-error"
                  : undefined
              }
            />
            <button
              type="button"
              className={styles["login-form__toggle"]}
              onClick={() => setShowToken((prev) => !prev)}
              disabled={isLoading}
              aria-label={showToken ? "Скрыть токен" : "Показать токен"}
            >
              {showToken ? "Скрыть" : "Показать"}
            </button>
          </div>
          {visibleError("apiTokenInstance") && (
            <p
              className={styles["login-form__error"]}
              id="apiTokenInstance-error"
              role="alert"
            >
              {visibleError("apiTokenInstance")}
            </p>
          )}
        </div>

        <button
          type="submit"
          className={styles["login-form__submit"]}
          disabled={!isFormValid || isLoading}
        >
          {isLoading ? "Подключение..." : "Войти"}
        </button>
        {error && (
          <p className={styles["login-form__error"]} role="alert">
            {error}
          </p>
        )}
      </form>
    </main>
  );
};
