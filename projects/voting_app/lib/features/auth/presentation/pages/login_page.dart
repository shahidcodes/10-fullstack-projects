import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:voting_app/app/router/app_routes.dart';

import '../bloc/auth_bloc.dart';
import '../bloc/auth_event.dart';
import '../bloc/auth_state.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();

  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _login() {
    if (!_formKey.currentState!.validate()) return;

    context.read<AuthBloc>().add(
      AuthLoginRequested(
        email: _emailController.text.trim(),
        password: _passwordController.text,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: BlocConsumer<AuthBloc, AuthState>(
                listener: (context, state) {
                  if (state is AuthFailure) {
                    ScaffoldMessenger.of(context)
                      ..hideCurrentSnackBar()
                      ..showSnackBar(
                        SnackBar(
                          content: Text(state.message),
                          backgroundColor: theme.colorScheme.error,
                        ),
                      );
                  }
                },
                builder: (context, state) {
                  final isLoading = state is AuthLoading;

                  return Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // App branding
                        Icon(
                          Icons.how_to_vote_rounded,
                          size: 64,
                          color: theme.colorScheme.primary,
                        ),
                        const SizedBox(height: 20),

                        Text(
                          'Welcome to VoteSphere',
                          textAlign: TextAlign.center,
                          style: theme.textTheme.headlineMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 8),

                        Text(
                          'Sign in to continue to your account',
                          textAlign: TextAlign.center,
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                        const SizedBox(height: 36),

                        // Email
                        Text(
                          'Email address',
                          style: theme.textTheme.labelLarge,
                        ),
                        const SizedBox(height: 8),

                        TextFormField(
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          textInputAction: TextInputAction.next,
                          autofillHints: const [AutofillHints.username],
                          decoration: const InputDecoration(
                            hintText: 'Enter your email',
                            prefixIcon: Icon(Icons.email_outlined),
                            border: OutlineInputBorder(),
                          ),
                          validator: (value) {
                            final email = value?.trim() ?? '';

                            if (email.isEmpty) {
                              return 'Email is required';
                            }

                            if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
                                .hasMatch(email)) {
                              return 'Enter a valid email address';
                            }

                            return null;
                          },
                        ),
                        const SizedBox(height: 20),

                        // Password
                        Text('Password', style: theme.textTheme.labelLarge),
                        const SizedBox(height: 8),

                        TextFormField(
                          controller: _passwordController,
                          obscureText: _obscurePassword,
                          textInputAction: TextInputAction.done,
                          autofillHints: const [AutofillHints.password],
                          onFieldSubmitted: (_) => _login(),
                          decoration: InputDecoration(
                            hintText: 'Enter your password',
                            prefixIcon: const Icon(Icons.lock_outline),
                            border: const OutlineInputBorder(),
                            suffixIcon: IconButton(
                              onPressed: () {
                                setState(() {
                                  _obscurePassword = !_obscurePassword;
                                });
                              },
                              icon: Icon(
                                _obscurePassword
                                    ? Icons.visibility_outlined
                                    : Icons.visibility_off_outlined,
                              ),
                            ),
                          ),
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return 'Password is required';
                            }

                            return null;
                          },
                        ),
                        const SizedBox(height: 28),

                        // Login button
                        SizedBox(
                          height: 52,
                          child: FilledButton(
                            onPressed: isLoading ? null : _login,
                            child: isLoading
                                ? const SizedBox(
                                    height: 22,
                                    width: 22,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  )
                                : const Text(
                                    'Sign In',
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                          ),
                        ),
                        const SizedBox(height: 24),

                        // Registration link will be connected next.
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Text("Don't have an account? "),
                            TextButton(
                              onPressed: () {
                                // We'll connect the Register route next.
                                context.push(AppRoutes.register);
                              },
                              child: const Text('Create account'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ),
        ),
      ),
    );
  }
}
