import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:voting_app/features/auth/data/repositories/auth_repository.dart';
import 'package:voting_app/features/auth/presentation/bloc/auth_event.dart';
import 'package:voting_app/features/auth/presentation/bloc/auth_state.dart';

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final AuthRepository _authRepository;

  AuthBloc({required this._authRepository}) : super(const AuthInitial()) {
    on<AuthCheckRequested>(_onAuthCheckRequested);
    on<AuthRegisterRequested>(_onRegisterRequested);
    on<AuthLoginRequested>(_onLoginRequested);
    on<AuthRefreshRequested>(_onRefreshRequested);
    on<AuthLogoutRequested>(_onLogoutRequested);
  }

  // Restore an existing authentication session.
  Future<void> _onAuthCheckRequested(
    AuthCheckRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthChecking());

    try {
      final user = await _authRepository.getCurrentUser();
      emit(Authenticated(user));
    } catch (_) {
      emit(const Unauthenticated());
    }
  }

  // Register.
  Future<void> _onRegisterRequested(
    AuthRegisterRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());

    try {
      final result = await _authRepository.register(
        name: event.name,
        email: event.email,
        password: event.password,
      );

      emit(Authenticated(result.user));
    } catch (error) {
      emit(AuthFailure(_extractMessage(error)));
    }
  }

  // Login.
  Future<void> _onLoginRequested(
    AuthLoginRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());

    try {
      final result = await _authRepository.login(
        email: event.email,
        password: event.password,
      );

      emit(Authenticated(result.user));
    } catch (error) {
      emit(AuthFailure(_extractMessage(error)));
    }
  }

  // Refresh tokens.
  Future<void> _onRefreshRequested(
    AuthRefreshRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());

    try {
      final result = await _authRepository.refreshToken();
      emit(Authenticated(result.user));
    } catch (error) {
      emit(AuthFailure(_extractMessage(error)));
    }
  }

  // Logout.
  Future<void> _onLogoutRequested(
    AuthLogoutRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());

    try {
      await _authRepository.logout();
      emit(const Unauthenticated());
    } catch (error) {
      emit(AuthFailure(_extractMessage(error)));
    }
  }

  String _extractMessage(Object error) {
    return error.toString().replaceFirst('Exception: ', '');
  }
}
