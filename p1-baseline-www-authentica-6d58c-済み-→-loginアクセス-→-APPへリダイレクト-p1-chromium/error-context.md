# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - heading "ログイン" [level=1] [ref=e4]
    - generic [ref=e5]:
      - generic [ref=e6]:
        - generic [ref=e7]: メールアドレス
        - textbox "メールアドレス" [ref=e8]:
          - /placeholder: you@example.com
      - generic [ref=e9]:
        - generic [ref=e10]: パスワード
        - textbox "パスワード" [ref=e11]:
          - /placeholder: ••••••••
      - button "ログイン" [ref=e12] [cursor=pointer]
      - paragraph [ref=e13]: メールアドレスとパスワードでログインします。
  - alert [ref=e14]
```